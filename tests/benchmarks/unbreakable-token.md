# Unbreakable Token benchmark

Issue #7 fixes the canonical Unbreakable Token at 64 ASCII-alphanumeric
characters:

```text
UTL0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy
```

The browser benchmark compares continuous 32-, 64-, and 128-character
candidates in the same controlled 480 px content container. Thirty-two
characters remain within that boundary. Sixty-four characters exceed it while
remaining below 800 px in the controlled Chrome rendering environment. One
hundred twenty-eight characters are wider again and produce substantially more
stress than needed for the single MVP intensity.

The browser fixture also verifies that the token occupies one client rect: the
Scenario intentionally introduces no wrapping opportunity inside it. Its `UTL`
prefix identifies synthetic fixture data during development; the remaining
sequence is generic and has no URL, email, language, identifier, or product
semantics. The same token is appended to every Eligible Text Node after one
ASCII space, independently of the node's content.

Unlike Long Text, Unbreakable Text does not need lexical material from the
source. Its fixture therefore selects one grapheme as the minimum meaningful
source: a one-character label is stressed, while a whitespace-only node is
excluded. This keeps the rule structural and avoids semantic classification of
punctuation, identifiers, URLs, emails, or languages.

The selected length is a detector input, not a severity threshold or a claim
about real translated content.
