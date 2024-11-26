import boto3

def lambda_handler(event, context):
    # /GET /short-url.
    # This function receives a GET request from a user to shorten a URL
    # It checks to see if there is already a value in DDB for the specified URL path
    # If exists it returns the value to the user,
    # else it creates a short URL, stores it in the database, and returns it to the user

    # /GET /{short-url-path-parameter}
    # When a short URL path parameter is received, parse the URL for the string after the base URL
    # Check that there is a value that exists for this URL, and 301 redirect the user to that URL if it exists
    # If there is no value for that short URL, tell the user that it is an invalid shortened path
    pass
