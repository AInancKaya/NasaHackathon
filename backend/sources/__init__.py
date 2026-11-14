# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Live data sources. Every fetch is real; failures raise one of the errors below."""


class UpstreamError(Exception):
    """The upstream service failed or returned something unusable (HTTP 502)."""


class NoDataError(Exception):
    """The upstream service has no data for the requested place/period (HTTP 404)."""
