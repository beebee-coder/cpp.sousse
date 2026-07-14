use crate::vector_store::types::Document;
use std::collections::{HashMap, HashSet};

const STOP_WORDS: &[&str] = &[
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "ce", "ces", "pour", "sur",
    "dans", "avec", "est", "sont", "que", "qui", "dans", "pas", "plus", "par", "au", "aux",
    "ne", "se", "sa", "son", "ses", "ma", "mon", "mes", "ta", "ton", "tes", "va", "votre",
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "ont", "été", "être", "avoir",
    "fait", "faire", "dire", "aller", "voir", "pouvoir", "vouloir", "venir", "falloir",
];

pub fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() >= 2 && !STOP_WORDS.contains(s))
        .map(|s| s.to_string())
        .collect()
}

pub fn tokenize_with_stems(text: &str) -> Vec<String> {
    let tokens = tokenize(text);
    tokens.into_iter().map(|t| simple_stem(&t)).collect()
}

fn simple_stem(word: &str) -> String {
    if word.len() <= 3 {
        return word.to_string();
    }

    if word.ends_with("eurs") || word.ends_with("euse") {
        return word[..word.len() - 3].to_string();
    }
    if word.ends_with("aux") {
        return word[..word.len() - 2].to_string();
    }
    if word.ends_with("aux") {
        return word[..word.len() - 2].to_string();
    }
    if word.ends_with("eur") {
        return word[..word.len() - 3].to_string();
    }
    if word.ends_with("eux") || word.ends_with("ies") || word.ends_with("ées") {
        return word[..word.len() - 2].to_string();
    }
    if word.ends_with("ment") && word.len() > 5 {
        return word[..word.len() - 4].to_string();
    }
    if word.ends_with("tion") || word.ends_with("sion") {
        return word[..word.len() - 3].to_string();
    }
    if word.ends_with('s') || word.ends_with('x') {
        return word[..word.len() - 1].to_string();
    }
    if word.ends_with("ent") || word.ends_with("ant") {
        return word[..word.len() - 3].to_string();
    }
    if word.ends_with("é") || word.ends_with("ée") || word.ends_with("és") || word.ends_with("ées") {
        return word[..word.len() - 1].to_string();
    }

    word.to_string()
}

pub struct Vocabulary {
    pub terms: Vec<String>,
    pub term_to_index: HashMap<String, usize>,
    pub document_frequencies: HashMap<String, usize>,
    pub total_documents: usize,
    pub dimensions: usize,
}

impl Vocabulary {
    pub fn new(dimensions: usize) -> Self {
        Self {
            terms: Vec::new(),
            term_to_index: HashMap::new(),
            document_frequencies: HashMap::new(),
            total_documents: 0,
            dimensions,
        }
    }

    pub fn fit(&mut self, documents: &[Document]) {
        let mut doc_term_sets: Vec<HashSet<String>> = Vec::new();

        for doc in documents {
            let tokens = tokenize_with_stems(&doc.content);
            let unique_terms: HashSet<String> = tokens.into_iter().collect();
            doc_term_sets.push(unique_terms);
        }

        for term_set in &doc_term_sets {
            for term in term_set {
                *self.document_frequencies.entry(term.clone()).or_insert(0) += 1;
            }
        }

        self.total_documents = documents.len();

        let mut sorted_terms: Vec<_> = self.document_frequencies.keys().cloned().collect();
        sorted_terms.sort_by(|a, b| {
            let freq_a = self.document_frequencies.get(a).unwrap_or(&0);
            let freq_b = self.document_frequencies.get(b).unwrap_or(&0);
            freq_a.cmp(freq_b).reverse()
        });

        self.terms = sorted_terms.into_iter().take(self.dimensions).collect();
        for (idx, term) in self.terms.iter().enumerate() {
            self.term_to_index.insert(term.clone(), idx);
        }
    }

    pub fn idf(&self, term: &str) -> f32 {
        let df = self.document_frequencies.get(term).copied().unwrap_or(0);
        if df == 0 {
            return 0.0;
        }
        let n = self.total_documents as f32;
        (n / (df as f32)).ln() + 1.0
    }
}

pub fn compute_tfidf_vector(tokens: &[String], vocab: &Vocabulary) -> Vec<f32> {
    let mut vec = vec![0.0f32; vocab.dimensions];
    let mut term_counts: HashMap<&str, usize> = HashMap::new();

    for token in tokens {
        *term_counts.entry(token.as_str()).or_insert(0) += 1;
    }

    let total_terms = tokens.len() as f32;
    if total_terms == 0.0 {
        return vec;
    }

    for (term, &count) in &term_counts {
        if let Some(&idx) = vocab.term_to_index.get(*term) {
            let tf = count as f32 / total_terms;
            let idf = vocab.idf(*term);
            vec[idx] = tf * idf;
        }
    }

    l2_normalize(&mut vec);
    vec
}

pub fn l2_normalize(vec: &mut [f32]) {
    let sum_sq: f32 = vec.iter().map(|x| x * x).sum();
    if sum_sq > 0.0 {
        let norm = sum_sq.sqrt();
        for v in vec {
            *v /= norm;
        }
    }
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let mut dot = 0.0;
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
    }
    dot
}
