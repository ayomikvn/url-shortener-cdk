import boto3
from boto3.dynamodb.types import TypeDeserializer
import json
import os
import hashlib
import logging
import validators
from datetime import datetime, timezone, timedelta

logging.basicConfig(
    format="{levelname} {asctime} {message}",
    style="{",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.DEBUG,
    encoding="utf-8",
)

ddb_client = boto3.client("dynamodb")
URL_SHORTENER_DDB_TABLE = os.environ["URL_SHORTENER_DDB_TABLE"]


def lambda_handler(event, context):
    timeToLiveInSeconds = 259200  # Three days, it could be configurable in future
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Credentials": "true",
    }
    response = {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"message": "Welcome to my URL shortening service!"}),
    }

    if event["httpMethod"] == "OPTIONS":
        response.update(
            {"body": json.dumps({"message": "Preflight Request Successful"})}
        )

    if event["httpMethod"] == "POST" and event["body"]:
        payload = json.loads(event["body"])
        originalUrl = payload["originalUrl"]

        if event["path"] == "/" and is_valid_url(originalUrl):
            short_url_id = create_short_url(originalUrl)
            ddb_dict_item = {}

            try:
                ddb_dict_item = get_short_url_data(short_url_id)
            except Exception as e:
                response["body"] = json.dumps(
                    {
                        "error": {
                            "type": "Server-side error",
                            "message": "Unable to create short URL, please try again",
                        }
                    }
                )
                logging.info(f"An error occurred: {e}")
                logging.error("Failed to retrieve Short URL data", exc_info=True)

            if ddb_dict_item and not is_short_url_expired(ddb_dict_item):
                response.update(
                    {
                        "body": json.dumps(
                            {"data": {"shortUrl": ddb_dict_item["shortUrlId"]}}
                        )
                    }
                )
            else:
                try:
                    ddb_update_response = add_short_url_to_database(
                        short_url_id, originalUrl, timeToLiveInSeconds
                    )

                    response.update(
                        {
                            "statusCode": ddb_update_response,
                            "body": json.dumps({"data": {"shortUrl": short_url_id}}),
                        }
                    )
                except Exception as e:
                    response.update(
                        {
                            "body": json.dumps(
                                {
                                    "error": {
                                        "type": "Server-side error",
                                        "message": "Unable to create short URL, please try again",
                                    }
                                }
                            )
                        }
                    )
                    logging.error("Failed to add Short URL to database", exc_info=True)
        else:
            response.update(
                {
                    "body": json.dumps(
                        {
                            "error": {
                                "type": "Client-side error",
                                "message": "Invalid URL. Please send a valid URL to be shortened",
                            }
                        }
                    )
                }
            )

    elif event["httpMethod"] == "GET":
        # Extract short URL ID from the path
        short_url_id = event.get("path")[1:]

        try:
            response_dict = redirect_to_original_url(short_url_id)
            response.update(response_dict)
        except Exception as e:
            response.update(
                {
                    "body": json.dumps(
                        {
                            "error": {
                                "type": "Server-side error",
                                "message": "Something went wrong, unable to redirect to destination",
                            }
                        }
                    )
                }
            )
            logging.info(f"An error occurred: {e}")
            logging.error("Failed to redirect to destination", exc_info=True)

    else:
        response.update(
            {
                "body": json.dumps(
                    {
                        "error": {
                            "type": "Client-side error",
                            "message": "Invalid request. Please review the request and try again",
                        }
                    }
                )
            }
        )

    return response


def is_valid_url(originalUrl: str) -> bool:
    return validators.url(originalUrl)


def create_short_url(original_url: str) -> str:
    encoded_url = original_url.encode("utf-8")

    hash_object = hashlib.md5(encoded_url)

    return hash_object.hexdigest()


def get_short_url_data(short_url_id: str) -> str:
    ddb_dict_item = None

    ddb_response = ddb_client.get_item(
        TableName=URL_SHORTENER_DDB_TABLE,
        Key={
            "shortUrlId": {"S": short_url_id},
        },
        ProjectionExpression="shortUrlId, originalUrl, timeToLiveInSeconds, createdAt",
    )

    if ddb_response.get("Item"):
        ddb_dict_item = dynamodb_item_to_dict(ddb_response.get("Item"))

    return ddb_dict_item


def add_short_url_to_database(
    short_url_id: str, originalUrl: str, timeToLiveInSeconds: int
) -> int:
    ddb_response = ddb_client.put_item(
        TableName=URL_SHORTENER_DDB_TABLE,
        Item={
            "shortUrlId": {"S": short_url_id},
            "timeToLiveInSeconds": {"N": str(timeToLiveInSeconds)},
            "createdAt": {
                "S": datetime.now(timezone.utc).isoformat()
            },  # ISO Format returns string
            "originalUrl": {"S": originalUrl},
        },
    )

    return ddb_response["ResponseMetadata"]["HTTPStatusCode"]


def dynamodb_item_to_dict(dynamodb_item: dict) -> dict:
    if not dynamodb_item:
        raise Exception("No DynamoDB Item to convert")

    deserializer = TypeDeserializer()
    return {
        key: deserializer.deserialize(value) for key, value in dynamodb_item.items()
    }


def is_short_url_expired(ddb_dict_item: dict) -> bool:
    createdAt = datetime.fromisoformat(ddb_dict_item["createdAt"])
    timeToLiveInSeconds = int(ddb_dict_item["timeToLiveInSeconds"])
    return datetime.now(timezone.utc) > (
        createdAt + timedelta(seconds=timeToLiveInSeconds)
    )


def redirect_to_original_url(short_url_id: str) -> dict:
    response_dict = {}
    ddb_dict_item = get_short_url_data(short_url_id)

    if ddb_dict_item:
        if not is_short_url_expired(ddb_dict_item):
            response_dict = {
                "statusCode": 301,
                "headers": {
                    "Location": ddb_dict_item["originalUrl"],
                },
            }
        else:
            response_dict = {
                "statusCode": 404,
                "body": json.dumps({"message": "The specified short URL has expired"}),
            }
    else:
        response_dict = {
            "statusCode": 404,
            "body": json.dumps({"message": "Invalid short URL"}),
        }

    return response_dict
