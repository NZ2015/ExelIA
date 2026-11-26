
import { handleUpload } from "@vercel/blob/client";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
];

function jsonResponse(res, status, data) {
    return res.status(status).json(data);
}

// Vérification réelle de l'utilisateur avec Supabase.
async function getAuthenticatedUser(req) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Configuration Supabase manquante.");
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }

    const accessToken = authHeader.slice(7);

    const supabase = createClient(
        supabaseUrl,
        supabaseKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );

    const { data, error } =
        await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
        return null;
    }

    return data.user;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return jsonResponse(res, 405, {
            success: false,
            message: "Méthode non autorisée."
        });
    }

    try {
        const user = await getAuthenticatedUser(req);

        if (!user) {
            return jsonResponse(res, 401, {
                success: false,
                message: "Utilisateur non connecté ou session expirée."
            });
        }

        const body = req.body;

        if (!body || typeof body !== "object") {
            return jsonResponse(res, 400, {
                success: false,
                message: "Requête invalide."
            });
        }

        const protocol =
            req.headers["x-forwarded-proto"] || "https";

        const host = req.headers.host;

        if (!host) {
            return jsonResponse(res, 400, {
                success: false,
                message: "Hôte de requête introuvable."
            });
        }

        const headers = new Headers();

        for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
                headers.set(key, value.join(", "));
            } else if (value !== undefined) {
                headers.set(key, String(value));
            }
        }

        const request = new Request(
            `${protocol}://${host}${req.url}`,
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            }
        );

        const result = await handleUpload({
            request,
            body,

            onBeforeGenerateToken: async (pathname) => {
                const userFolder =
                    `users/${encodeURIComponent(user.id)}/`;

                if (
                    typeof pathname !== "string" ||
                    !pathname.startsWith(userFolder)
                ) {
                    throw new Error(
                        "Chemin de dépôt non autorisé."
                    );
                }

                const extension = pathname.toLowerCase();

                if (
                    !extension.endsWith(".xlsx") &&
                    !extension.endsWith(".xls")
                ) {
                    throw new Error(
                        "Seuls les fichiers Excel sont acceptés."
                    );
                }

                return {
                    allowedContentTypes: ALLOWED_TYPES,
                    maximumSizeInBytes: MAX_FILE_SIZE,
                    addRandomSuffix: true,
                    allowOverwrite: false,

                    tokenPayload: JSON.stringify({
                        userId: user.id
                    })
                };
            },

            onUploadCompleted: async ({
                blob,
                tokenPayload
            }) => {
                const metadata = JSON.parse(
                    tokenPayload || "{}"
                );

                if (!metadata.userId) {
                    throw new Error(
                        "Propriétaire du fichier introuvable."
                    );
                }

                console.log("Fichier Excel déposé :", {
                    ownerId: metadata.userId,
                    pathname: blob.pathname
                });
            }
        });

        return jsonResponse(res, 200, {
            success: true,
            ...result
        });

    } catch (error) {
        console.error(
            "Erreur API upload :",
            error.message
        );

        return jsonResponse(res, 400, {
            success: false,
            message: "Échec du dépôt du fichier Excel."
        });
    }
}

