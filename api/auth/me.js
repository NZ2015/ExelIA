import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Méthode non autorisée."
    });
  }

  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise."
      });
    }

    const token = authorization.slice(7);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: "Session invalide ou expirée."
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username || ""
      }
    });

  } catch (error) {
    console.error("Erreur vérification utilisateur :", error);

    return res.status(500).json({
      success: false,
      message: "Impossible de vérifier la session."
    });
  }
}
