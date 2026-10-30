"""Runtime-mode and CORS settings: the deployment switches TSD §4.1 documents."""

from config import Settings


def test_defaults_are_development_and_wildcard():
    settings = Settings(fastapi_env="development", cors_origins="*")
    assert settings.is_development is True
    assert settings.is_production is False
    assert settings.cors_origin_list == ["*"]


def test_production_is_case_and_padding_insensitive():
    assert Settings(fastapi_env="Production ").is_production is True
    assert Settings(fastapi_env="PRODUCTION").is_development is False


def test_test_mode_seeds_nothing():
    settings = Settings(fastapi_env="test")
    assert settings.is_development is False
    assert settings.is_production is False


def test_cors_list_is_trimmed_and_drops_blanks():
    settings = Settings(cors_origins=" http://localhost:3000 , , https://portal.example ")
    assert settings.cors_origin_list == ["http://localhost:3000", "https://portal.example"]


def test_cors_blank_falls_back_to_wildcard():
    assert Settings(cors_origins="  ,  ").cors_origin_list == ["*"]


def test_report_photo_ceiling_stays_under_the_platform_request_limit():
    # Vercel Functions reject a request body above ~4.5 MB before the app sees
    # it, so a larger ceiling would trade the API's 413 for an opaque platform
    # error. Keep the default under it; an explicit override is a deployment call.
    assert Settings().report_photo_max_bytes <= 4 * 1024 * 1024
