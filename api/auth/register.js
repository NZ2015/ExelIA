import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Méthode non autorisée."
    });
  }

  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs sont obligatoires."
      });
    }

    if (username.trim().length < 3 || username.trim().length > 30) {
      return res.status(400).json({
        success: false,
        message: "Le nom doit contenir entre 3 et 30 caractères."
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe doit contenir au moins 12 caractères."
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          username: username.trim()
        }
      }
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: data.session
        ? "Compte créé avec succès."
        : "Compte créé. Vérifie ta boîte e-mail pour confirmer ton inscription.",
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username || ""
          }
        : null,
      session: data.session
    });

  } catch (error) {
    console.error("Erreur inscription :", error);

    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue pendant l'inscription."
    });
  }
}
