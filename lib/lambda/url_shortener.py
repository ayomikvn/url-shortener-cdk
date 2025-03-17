import json
import hashlib
from logger import logger
import validators
from database_connector import DatabaseConnector
from datetime import datetime, timezone, timedelta


class UrlShortener:
    def __init__(self):
        self.ttl_seconds = 259200  # 3 days in seconds
        self.ddb_connector = DatabaseConnector()
        self.cors_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Credentials": "true",
        }
        self.response = {
            "statusCode": 200,
            "headers": self.cors_headers,
            "body": json.dumps({"message": "Welcome to my URL shortening service!"}),
        }

    def set_ttl_seconds(self, ttl_seconds: int) -> None:
        self.ttl_seconds = ttl_seconds

    def handle_get(self, short_url_id: str) -> dict:
        """Handles GET request to retrieve and redirect to the original URL."""
        try:
            short_url_ddb_item = self.ddb_connector.get_short_url_data(short_url_id)
            self._process_redirect_to_original_url(short_url_ddb_item)
        except Exception as e:
            logger.error("Failed to redirect to destination", exc_info=True)
            self.set_server_side_error(
                "Something went wrong, unable to redirect to destination"
            )

        return self.response

    def handle_post(self, request_path, original_url):
        if request_path != "/" or not self.validate_long_url(original_url):
            logger.info(f"Invalid URL sent by user: {original_url}")
            self.set_client_side_error("Invalid URL. Please send a valid URL to be shortened")
            return self.response

        logger.info(f"Generating short URL for: {original_url}")
        short_url_id = self.generate_short_url(original_url)

        try:
            logger.debug(f"Retrieve short URL data from database, if any")
            existing_short_url_ddb_item = self.ddb_connector.get_short_url_data(
                short_url_id
            )

            # Use existing short URL if it is still valid
            if existing_short_url_ddb_item and not self.is_short_url_expired(
                existing_short_url_ddb_item
            ):
                logger.info(f"Checking if there is an existing and valid short URL for: {original_url}")
                short_url_id = existing_short_url_ddb_item["shortUrlId"]
            else:
                logger.info(f"Update database with short-original URL data mapping {original_url}")
                self.ddb_connector.put_short_url_data(
                    short_url_id, original_url, self.ttl_seconds
                )

            logger.info(f"Build API response, short URL is {short_url_id} and original URL is {original_url}")
            self.set_response(short_url_id)

        except Exception as e:
            logger.error("Failed to add Short URL to database", exc_info=True)
            self.set_server_side_error("Unable to create short URL, please try again")

        return self.response

    def handle_options(self) -> dict:
        """Handles OPTIONS request for CORS preflight."""
        logger.info(f"Handling preflight request for OPTIONS method")
        self.response.update(
            {"body": json.dumps({"message": "Preflight Request Successful"})}
        )

        return self.response

    def generate_short_url(self, original_url: str) -> str:
        encoded_url = original_url.encode("utf-8")
        hash_object = hashlib.md5(encoded_url)

        return hash_object.hexdigest()

    def validate_long_url(self, original_url: str) -> bool:
        return validators.url(original_url)

    def is_short_url_expired(self, ddb_dict_item: dict) -> bool:
        try:
            created_at = datetime.fromisoformat(ddb_dict_item["createdAt"])
            time_to_live_in_seconds = int(ddb_dict_item["timeToLiveInSeconds"])

            return datetime.now(timezone.utc) > (
                created_at + timedelta(seconds=time_to_live_in_seconds)
            )
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Error checking time to live expiry: {e}")
            return True  # Assume expired if there's a parsing issue

    def _process_redirect_to_original_url(self, short_url_ddb_item: dict):
        if not short_url_ddb_item:
            self._handle_invalid_short_url_request(short_url_ddb_item)

        if self.is_short_url_expired(short_url_ddb_item):
            self._handle_expired_short_url_request(short_url_ddb_item)

        logger.info(f"Building API redirect response")
        self._set_redirect_response(short_url_ddb_item)

    def _handle_expired_short_url_request(self, short_url_ddb_item):
        logger.error(f"The specified short URL has expired: \n{short_url_ddb_item}")
        self.response.update(
            {
                "statusCode": 404,
                "body": json.dumps({"message": "The specified short URL has expired"}),
            }
        )

    def _handle_invalid_short_url_request(self, short_url_ddb_item):
        logger.error(f"No Short URL data passed: \n{short_url_ddb_item}")
        self.response.update(
            {
                "statusCode": 404,
                "body": json.dumps({"message": "Invalid short URL"}),
            }
        )

    def set_response(self, short_url_id):
        self.response.update({"body": json.dumps({"data": {"shortUrl": short_url_id}})})

    def _set_redirect_response(self, short_url_ddb_item):
        self.response.update(
            {
                "statusCode": 301,
                "headers": {
                    "Location": short_url_ddb_item["originalUrl"],
                },
            }
        )

    def set_server_side_error(self, message: str, http_status_code=500):
        self.response.update(
            {
                "statusCode": http_status_code,
                "body": json.dumps(
                    {
                        "error": {
                            "type": "Server-side error",
                            "message": message,
                        }
                    }
                ),
            }
        )

    def set_client_side_error(self, message: str, http_status_code=400):
        self.response.update(
            {
                "statusCode": http_status_code,
                "body": json.dumps(
                    {
                        "error": {
                            "type": "Client-side error",
                            "message": message,
                        }
                    }
                ),
            }
        )
