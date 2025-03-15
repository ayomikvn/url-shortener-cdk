import json
from url_shortener import UrlShortener

url_shortener = UrlShortener()


def lambda_handler(event, context):
    if event["httpMethod"] == "OPTIONS":
        url_shortener.handle_options()
    
    elif event["httpMethod"] == "GET":
        short_url_id = event.get("path")[1:]
        url_shortener.handle_get(short_url_id)

    elif event["httpMethod"] == "POST" and event["body"]:
        payload = json.loads(event["body"])
        original_url = payload.get("originalUrl", "")
        request_path = event["path"]

        url_shortener.handle_post(request_path, original_url)
        
    else:
        url_shortener.set_client_side_error("Invalid request. Please review the request and try again")
        return url_shortener.response
