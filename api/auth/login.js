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
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "L'e-mail et le mot de passe sont obligatoires."
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: "Adresse e-mail ou mot de passe incorrect."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Connexion réussie.",
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username || ""
      },
      session: data.session
    });

  } catch (error) {
    console.error("Erreur connexion :", error);

    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue pendant la connexion."
    });
  }
}
