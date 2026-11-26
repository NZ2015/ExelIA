import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({
        success: false,
        message: "Session invalide."
      });
    }

    const { error } = await supabaseAdmin.auth.admin.signOut(
      token,
      "global"
    );

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Déconnexion réussie."
    });

  } catch (error) {
    console.error("Erreur déconnexion :", error);

    return res.status(500).json({
      success: false,
      message: "Impossible de fermer la session."
    });
  }
}
