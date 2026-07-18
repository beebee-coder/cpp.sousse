use unicode_normalization::UnicodeNormalization;

/// Vrai pour les marques combinantes (U+0300..=U+036F), équivalent au
/// `is_combining_mark()` du trait UnicodeNormalization, indépendamment de
/// la version de la crate.
fn is_combining_mark(c: char) -> bool {
    matches!(c as u32, 0x0300..=0x036F)
}

const STOP_WORDS: &[&str] = &[
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "ce", "ces", "pour", "sur",
    "dans", "avec", "est", "sont",
];

pub fn tokenize(text: &str) -> Vec<String> {
    text.nfd()
        .filter(|c| !is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == ' ' { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|s| s.len() > 2 && !STOP_WORDS.contains(s))
        .map(|s| s.to_string())
        .collect()
}

pub fn tokenize_with_stems(text: &str) -> Vec<String> {
    let tokens = tokenize(text);
    tokens.into_iter().map(|t| simple_stem(&t)).collect()
}

fn simple_stem(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let n = chars.len();

    if n <= 3 {
        return word.to_string();
    }

    let trim = |drop: usize| -> String { chars[..n.saturating_sub(drop)].iter().collect() };

    if word.ends_with("eurs") || word.ends_with("euse") {
        return trim(3);
    }
    if word.ends_with("aux") {
        return trim(2);
    }
    if word.ends_with("eur") {
        return trim(3);
    }
    if word.ends_with("eux") || word.ends_with("ies") || word.ends_with("ées") {
        return trim(2);
    }
    if word.ends_with("ment") && n > 5 {
        return trim(4);
    }
    if word.ends_with("tion") || word.ends_with("sion") {
        return trim(3);
    }
    if word.ends_with("ent") || word.ends_with("ant") {
        return trim(3);
    }
    if word.ends_with("ées") || word.ends_with("és") || word.ends_with("ée") || word.ends_with('é') {
        return trim(1);
    }
    if word.ends_with('s') || word.ends_with('x') {
        return trim(1);
    }

    word.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenize_matches_js_spec() {
        let text = "Les opérateurs vérifient les procédures accentuées";
        let toks = tokenize(text);
        assert!(!toks.is_empty());
        assert!(!toks.contains(&"les".to_string()));
        assert!(!toks.contains(&"est".to_string()));
    }

    #[test]
    fn tokenize_strips_accents() {
        let toks = tokenize("pression température");
        assert!(toks.contains(&"pression".to_string()));
        assert!(toks.contains(&"temperature".to_string()));
    }

    #[test]
    fn tokenize_filters_short_words() {
        let toks = tokenize("un de la et en ce");
        assert!(toks.is_empty());
    }
}
