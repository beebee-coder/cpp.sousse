use crate::vector_store::embedding::tokenize_with_stems;
use crate::vector_store::types::Document;

/// Générateur local léger (sans dépendance ML lourde).
///
/// Produit une réponse structurée et lisible à partir du contexte RAG récupéré
/// localement (TF-IDF / SQLite) et de la question. Aucune connexion réseau :
/// il synthétise les passages les plus pertinents du corpus indexé en les
/// regroupant par source et en extrayant les phrases clés liées à la requête.
pub struct OfflineGenerator;

impl OfflineGenerator {
    /// Génère une réponse hors-ligne à partir des documents pertinents.
    ///
    /// `documents` : passages triés par score décroissant (résultat du search RAG).
    /// `query` : question originale de l'utilisateur.
    pub fn generate(documents: &[Document], query: &str) -> String {
        if documents.is_empty() {
            return Self::no_context_answer(query);
        }

        let query_tokens = tokenize_with_stems(query);
        let mut sections: Vec<String> = Vec::new();
        let mut used_sentences: usize = 0;
        const MAX_SENTENCES: usize = 12;

        // Regroupe les passages par source (parent_dir / file_name) pour un rendu
        // lisible et tracé (traçabilité industrielle).
        for doc in documents {
            if used_sentences >= MAX_SENTENCES {
                break;
            }
            let source = Self::source_label(&doc.metadata.parent_dir, &doc.metadata.file_name, &doc.metadata.origin);
            let key_sentences = Self::extract_key_sentences(&doc.content, &query_tokens, MAX_SENTENCES - used_sentences);

            if key_sentences.is_empty() {
                continue;
            }
            used_sentences += key_sentences.len();

            let body = key_sentences
                .iter()
                .map(|s| format!("• {}", s))
                .collect::<Vec<_>>()
                .join("\n");

            sections.push(format!("📄 {source}\n{body}"));
        }

        if sections.is_empty() {
            // Aucune phrase clé alignée : on reprend les premiers passages intacts.
            for doc in documents.iter().take(3) {
                let source = Self::source_label(&doc.metadata.parent_dir, &doc.metadata.file_name, &doc.metadata.origin);
                let preview = Self::first_sentences(&doc.content, 2);
                sections.push(format!("📄 {source}\n• {}", preview.join(" ")));
            }
        }

        let intro = Self::intro_for(query);
        let outro = "\n\n— Réponse générée en mode hors-ligne (Local Processing natif, RAG seul, sans Groq). \
                     Les extraits proviennent directement des documents indexés localement. \
                     Pour une analyse générative complète, connectez une clé Groq ou basculez en mode hybride.";

        format!("{intro}\n\n{}\n{outro}", sections.join("\n\n"))
    }

    fn intro_for(query: &str) -> String {
        let q = query.trim();
        if q.is_empty() {
            return "Voici les informations disponibles dans la base locale :".to_string();
        }
        format!("Concernant « {q} », la base locale contient les éléments suivants :")
    }

    fn no_context_answer(query: &str) -> String {
        format!(
            "⚠️ Mode hors-ligne (Local Processing natif) : aucune base de connaissances indexée \
             n'est disponible pour répondre.\n\nVotre question : « {} »\n\n\
             Pour activer la génération locale, indexez la base (.local-db) via l'explorateur BDD \
             ou configurez GROQ_API_KEY pour la génération cloud.",
            query
        )
    }

    /// Extrait les phrases du contenu les plus proches de la requête
    /// (chevauchement de tokens stemmés), triées par pertinence.
    fn extract_key_sentences(content: &str, query_tokens: &[String], max: usize) -> Vec<String> {
        if query_tokens.is_empty() {
            return Self::first_sentences(content, max);
        }
        let query_set: std::collections::HashSet<&str> = query_tokens.iter().map(|s| &**s).collect();

        let mut scored: Vec<(usize, String)> = content
            .split(&['\n', '.', '!', '?', ';', ':'])
            .map(|s| s.trim().to_string())
            .filter(|s| s.len() >= 12)
            .map(|s| {
                let tokens = tokenize_with_stems(&s);
                let overlap = tokens.iter().filter(|t| query_set.contains(t.as_str())).count();
                (overlap, s)
            })
            .filter(|(overlap, _)| *overlap > 0)
            .collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0));
        scored.into_iter().take(max).map(|(_, s)| s).collect()
    }

    fn first_sentences(content: &str, n: usize) -> Vec<String> {
        content
            .split(&['\n', '.', '!', '?'])
            .map(|s| s.trim().to_string())
            .filter(|s| s.len() >= 12)
            .take(n)
            .collect()
    }

    fn source_label(parent_dir: &Option<String>, file_name: &Option<String>, origin: &str) -> String {
        let parts: Vec<&str> = [parent_dir.as_deref(), file_name.as_deref()]
            .iter()
            .flatten()
            .filter(|s| !s.is_empty())
            .map(|s| &**s)
            .collect();
        if parts.is_empty() {
            origin.to_string()
        } else {
            format!("{} | {}", origin, parts.join("/"))
        }
    }
}
