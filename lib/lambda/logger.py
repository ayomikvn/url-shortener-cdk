import logging

# Configure the root logger
logging.basicConfig(
    format="{levelname} {asctime} {message}",
    style="{",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.DEBUG,
    encoding="utf-8",
)

# Create a logger instance that other modules can import
logger = logging.getLogger(__name__)