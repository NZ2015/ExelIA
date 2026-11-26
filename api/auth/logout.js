
import { createClient } from "@supabase/supabase-js";

function jsonResponse(res, status, data) {
    return res.status(status).json(data);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return jsonResponse(res, 405, {
            success: false,
            message: "Méthode non autorisée."
        });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !secretKey) {
        return jsonResponse(res, 500, {
            success: false,
            message: "Configuration Supabase manquante."
        });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

    if (!accessToken) {
        return jsonResponse(res, 401, {
            success: false,
            message: "Session non trouvée."
        });
    }

    try {
        const supabaseAdmin = createClient(
            supabaseUrl,
            secretKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                }
            }
        );

        const { data, error: userError } =
            await supabaseAdmin.auth.getUser(accessToken);

        if (userError || !data.user) {
            return jsonResponse(res, 401, {
                success: false,
                message: "Session invalide ou expirée."
            });
        }

        const { error } =
            await supabaseAdmin.auth.admin.signOut(
                accessToken,
                "global"
            );

        if (error) {
            throw error;
        }

        return jsonResponse(res, 200, {
            success: true,
            message: "Déconnexion réussie."
        });

    } catch (error) {
        console.error("Erreur déconnexion :", error.message);

        return jsonResponse(res, 500, {
            success: false,
            message: "Impossible de terminer la déconnexion."
        });
    }
}
