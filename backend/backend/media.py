"""Helpers for user-uploaded media URLs.

Local dev serves files from the filesystem (relative ``/media/...`` URLs);
production stores them on Cloudflare R2, whose ``.url`` is already an
absolute public URL. These helpers hide that difference from API views.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.models.fields.files import FieldFile
    from django.http import HttpRequest


def absolute_media_url(request: HttpRequest, file: FieldFile | None) -> str | None:
    """Return an absolute URL for an ``ImageFieldFile`` (or ``None``)."""
    if not file:
        return None
    url = file.url
    if url.startswith(("http://", "https://")):
        return url
    return request.build_absolute_uri(url)
