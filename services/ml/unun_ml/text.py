"""Turning what people type into something that can be compared.

A dish in Dhaka has one name and many spellings. "কাচ্চি" is also written kacchi,
kachchi and kachi; "ভর্তা" is bhorta, vorta and bharta. Search has to treat them as the
same word.

Two steps do that:

1. `transliterate` writes Bangla script in Latin letters, sound by sound.
2. `phonetic_key` folds the Latin spellings that sound alike into one form.

Both sides of a comparison go through the same steps, so the key does not have to be
good Bangla or good English. It only has to be the same for the same word.
"""

from __future__ import annotations

import re
import unicodedata

HASANTA = "্"
NUKTA = "়"

CONSONANTS = {
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
    "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
    "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "f", "ব": "b", "ভ": "bh", "ম": "m",
    "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
    "স": "s", "হ": "h", "ৎ": "t",
    # ড়, ঢ় and য়, written by code point because editors store them in two ways.
    "\u09dc": "r", "\u09dd": "rh", "\u09df": "y",
}  # fmt: skip

VOWELS = {
    "অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u",
    "ঋ": "ri", "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
}  # fmt: skip

VOWEL_SIGNS = {
    "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u",
    "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
}  # fmt: skip

# Signs that follow a letter and add a sound of their own, or none.
MODIFIERS = {"ং": "ng", "ঃ": "h", "ঁ": ""}

BANGLA_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

# Three letters are stored either as one character or as a letter plus a dot below.
# Unicode's own normal form is the two-part one, so they are joined again by hand.
_DOTTED = {
    f"\u09a1{NUKTA}": "\u09dc",
    f"\u09a2{NUKTA}": "\u09dd",
    f"\u09af{NUKTA}": "\u09df",
}

_BANGLA = re.compile(r"[ঀ-৿]")


def has_bangla(text: str) -> bool:
    """True when the text has at least one letter in Bangla script."""
    return bool(_BANGLA.search(text))


def transliterate(text: str) -> str:
    """Writes Bangla script in Latin letters. Other characters pass through.

    A Bangla consonant carries a vowel of its own, "o", unless a vowel sign or a hasanta
    follows it. That vowel is silent at the end of a word, so it is left out there.
    Which other inherent vowels are silent depends on the word, and a rule cannot know,
    so this errs on the side of writing them. `phonetic_key` and the search's use of
    letter groups absorb the difference.
    """
    text = unicodedata.normalize("NFC", text).translate(BANGLA_DIGITS)
    for pair, single in _DOTTED.items():
        text = text.replace(pair, single)

    out: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""

        if char in CONSONANTS:
            out.append(CONSONANTS[char])
            if following == HASANTA:
                index += 2
                continue
            if following in VOWEL_SIGNS:
                out.append(VOWEL_SIGNS[following])
                index += 2
                continue
            if following in CONSONANTS or following in MODIFIERS:
                out.append("o")
        elif char in VOWELS:
            out.append(VOWELS[char])
        elif char in VOWEL_SIGNS:
            out.append(VOWEL_SIGNS[char])
        elif char in MODIFIERS:
            out.append(MODIFIERS[char])
        elif char != HASANTA:
            out.append(char)
        index += 1

    return "".join(out)


# Spellings of the "ch" sound. They are replaced by a placeholder first, so that the
# plain letter c, which is a k or an s sound, can be handled without touching them.
_CH = re.compile(r"cch|chh|tch|ch|cc")
_SOFT_C = re.compile(r"c(?=[eiy])")
_NOT_A_LETTER = re.compile(r"[^a-z0-9ঀ-৿]+")
_REPEATS = re.compile(r"(.)\1+")

# Letter groups that sound alike in the way Bangla is written with Latin letters.
# Order matters: longer groups come before the shorter ones they contain.
_FOLDS: tuple[tuple[str, str], ...] = (
    ("sh", "s"),
    ("ph", "f"),
    ("bh", "b"),
    ("v", "b"),
    ("kh", "k"),
    ("gh", "g"),
    ("th", "t"),
    ("dh", "d"),
    ("jh", "j"),
    ("rh", "r"),
    ("z", "j"),
    ("q", "k"),
    ("x", "ks"),
    ("w", "o"),
    ("ee", "i"),
    ("oo", "u"),
    ("ou", "o"),
    ("aa", "a"),
    ("y", "i"),
)


def phonetic_key(text: str) -> str:
    """The form of a piece of text that spellings of the same word share.

    >>> phonetic_key("Kachchi Biriyani") == phonetic_key("kacchi biryani")
    True
    >>> phonetic_key("কাচ্চি") == phonetic_key("kachi")
    True
    """
    text = unicodedata.normalize("NFKC", text).lower()
    if has_bangla(text):
        text = transliterate(text)

    words = []
    for word in _NOT_A_LETTER.sub(" ", text).split():
        word = _CH.sub("C", word)
        word = word.replace("ck", "k")
        word = _SOFT_C.sub("s", word).replace("c", "k")
        for group, sound in _FOLDS:
            word = word.replace(group, sound)
        word = _REPEATS.sub(r"\1", word.replace("C", "c"))
        if word:
            words.append(word)
    return " ".join(words)


_VOWELS = re.compile(r"[aeiou]")


def skeleton(key: str) -> str:
    """A phonetic key with the vowels taken out and two more sounds folded together.

    Vowels are where spellings of a Bangla word differ most: nehari and nihari, bhorta
    and bharta, porota and paratha. Bangla script also leaves some vowels unwritten, so
    a transliteration cannot always tell whether one is spoken. The consonants are the
    part people agree on. Two of those are folded as well, because they are swapped in
    everyday spelling: fuchka, fuska and puchka are one snack.

    >>> skeleton(phonetic_key("nihari")) == skeleton(phonetic_key("নেহারি"))
    True
    """
    words = []
    for word in key.split():
        bare = _VOWELS.sub("", word).replace("c", "s").replace("f", "p")
        # A word that is all vowels keeps itself, so it does not vanish.
        words.append(bare or word)
    return " ".join(words)


# Other names for the same food: English for a Bangla dish, or the name it has across
# the border. Written by hand, and short on purpose. A word here is searched for under
# its own name and under each of the others.
SYNONYMS: dict[str, tuple[str, ...]] = {
    "jalebi": ("jilapi",),
    "jilebi": ("jilapi",),
    "samosa": ("somucha", "shingara"),
    "hilsa": ("ilish",),
    "shrimp": ("prawn", "chingri"),
    "prawn": ("chingri",),
    "eggplant": ("begun",),
    "aubergine": ("begun",),
    "brinjal": ("begun",),
    "yogurt": ("doi",),
    "yoghurt": ("doi",),
    "curd": ("doi",),
    "dahi": ("doi",),
    "panipuri": ("fuchka",),
    "golgappa": ("fuchka",),
    "cola": ("soft drink",),
    "coke": ("soft drink",),
    "pepsi": ("soft drink",),
    "lentil": ("dal",),
    "lentils": ("dal",),
    "potato": ("aloo",),
    "mutton": ("khashi",),
    "sweet": ("mishti",),
    "sweets": ("mishti",),
    "tea": ("cha",),
    "rasgulla": ("roshogolla",),
    "pulao": ("polao",),
    "pilau": ("polao",),
    "chowmein": ("chow mein",),
    "chaumin": ("chow mein",),
    "khichdi": ("khichuri",),
    "murgi": ("chicken",),
    "goru": ("beef",),
}


def variants(query: str) -> list[str]:
    """The query as typed, then once more for each other name its words go by."""
    words = _NOT_A_LETTER.sub(" ", query.lower()).split()
    found = [query]
    for position, word in enumerate(words):
        for other in SYNONYMS.get(word, ()):
            found.append(" ".join([*words[:position], other, *words[position + 1 :]]))
    return found
