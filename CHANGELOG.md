# Change Log

All notable changes to the "raydaemon" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Fixed
- Fixed duplicate message issue where Ray responses were appearing twice in the chat interface
- Added duplicate tracking for command result sends to prevent sending the same results multiple times
- Added duplicate tracking for response processing to prevent processing the same response multiple times
- Added duplicate tracking for webhook request processing to prevent processing the same webhook request multiple times
- Fixed chat message handler to prevent sending both `rayResponse` and `chat_response` messages for the same response
- Improved resource management to prevent memory leaks from tracking processed responses and webhook requests
- Enhanced logging for webhook requests to help with debugging