import os
import boto3
from logger import logger
from datetime import datetime, timezone
from boto3.dynamodb.types import TypeDeserializer
from exceptions import DynamoDBDeserializationError


class DatabaseConnector:
    def __init__(self):
        self.ddb_client = boto3.client("dynamodb")
        self.ddb_table = os.environ["URL_SHORTENER_DDB_TABLE"]

    def get_short_url_data(self, short_url_id: str) -> dict:
        try:
            ddb_response = self.ddb_client.get_item(
                TableName=self.ddb_table,
                Key={
                    "shortUrlId": {"S": short_url_id},
                },
                ProjectionExpression="shortUrlId, originalUrl, timeToLiveInSeconds, createdAt",
            )

            if ddb_response.get("Item"):
                return self._deserialize_ddb_item(ddb_response.get("Item"))
        except Exception as e:
            logger.error(
                f"An error occurred when trying to retrieve the short URL from the database: {str(e)}"
            )
            raise

        return {}

    def put_short_url_data(
        self, short_url_id: str, original_url: str, ttl_seconds: int
    ) -> int:
        try:
            ddb_response = self.ddb_client.put_item(
                TableName=self.ddb_table,
                Item={
                    "shortUrlId": {"S": short_url_id},
                    "timeToLiveInSeconds": {"N": str(ttl_seconds)},
                    "createdAt": {
                        "S": datetime.now(timezone.utc).isoformat()
                    },  # ISO Format returns string
                    "originalUrl": {"S": original_url},
                },
            )

            return ddb_response["ResponseMetadata"]["HTTPStatusCode"]
        except Exception as e:
            logger.error(
                f"An error occurred when adding short URL to database: {str(e)}"
            )
            raise

    def _deserialize_ddb_item(self, dynamodb_item: dict) -> dict:
        if not dynamodb_item:
            raise DynamoDBDeserializationError("No DynamoDB Item to convert")

        deserializer = TypeDeserializer()

        return {
            key: deserializer.deserialize(value) for key, value in dynamodb_item.items()
        }
