import pytest

from unun_ml.text import has_bangla, phonetic_key, skeleton, transliterate, variants


@pytest.mark.parametrize(
    ("bangla", "latin"),
    [
        ("কাচ্চি", "kachchi"),
        ("বিরিয়ানি", "biriyani"),
        ("ভর্তা", "bhorta"),
        # The vowel between চ and ক is silent when spoken. A rule cannot know that, so
        # it is written, and the skeleton (below) is what makes the two match.
        ("ফুচকা", "fuchoka"),
        ("ইলিশ", "ilish"),
        ("চিংড়ি", "chingri"),
        ("দুধ চা", "dudh cha"),
        ("৫০০ মিলি", "500 mili"),
    ],
)
def test_bangla_is_written_in_latin_letters(bangla: str, latin: str) -> None:
    assert transliterate(bangla) == latin


def test_a_letter_stored_in_two_parts_reads_the_same_as_in_one() -> None:
    one_part = "চিংড়ি"
    two_parts = "চিংড়ি"
    assert transliterate(one_part) == transliterate(two_parts) == "chingri"


def test_other_text_passes_through_untouched() -> None:
    assert transliterate("Milk tea, 2") == "Milk tea, 2"
    assert not has_bangla("Milk tea")
    assert has_bangla("দুধ cha")


@pytest.mark.parametrize(
    "spellings",
    [
        ("kacchi", "kachchi", "kachi", "Kacci", "কাচ্চি"),
        ("biryani", "biriyani", "biriani", "বিরিয়ানি"),
        ("bhorta", "vorta", "ভর্তা"),
        ("fuchka", "phuchka"),
        ("roshogolla", "rosogolla"),
        ("halim", "haleem"),
        ("naan", "nan"),
        ("sheek", "shik", "seekh"),
    ],
)
def test_spellings_of_one_word_share_a_key(spellings: tuple[str, ...]) -> None:
    assert len({phonetic_key(spelling) for spelling in spellings}) == 1


def test_different_words_keep_different_keys() -> None:
    assert phonetic_key("cha") != phonetic_key("sa")
    assert phonetic_key("pitha") != phonetic_key("pizza")
    assert phonetic_key("curry") == "kuri"
    assert phonetic_key("rice") == "rise"


def test_punctuation_and_case_do_not_matter() -> None:
    assert phonetic_key("  Fuchka, 8 PIECES! ") == phonetic_key("fuchka 8 pieces")
    assert phonetic_key("") == ""


@pytest.mark.parametrize(
    "spellings",
    [
        ("nehari", "nihari", "নেহারি"),
        ("bhorta", "bharta"),
        ("porota", "paratha", "parota"),
        ("fuchka", "fuska", "puchka", "ফুচকা"),
        ("chotpoti", "chatpati", "চটপটি"),
        ("kabab", "kebab"),
    ],
)
def test_the_skeleton_ignores_vowels(spellings: tuple[str, ...]) -> None:
    assert len({skeleton(phonetic_key(spelling)) for spelling in spellings}) == 1


def test_a_word_of_vowels_keeps_itself() -> None:
    assert skeleton("ai") == "ai"


def test_variants_add_the_other_names_of_a_word() -> None:
    assert variants("hilsa fry") == ["hilsa fry", "ilish fry"]
    assert variants("kacchi") == ["kacchi"]
    assert "somucha" in variants("Samosa") and "shingara" in variants("Samosa")
