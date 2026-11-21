
import { handleUpload } from "@vercel/blob/client";

/*
 * IA Exel — API de dépôt des fichiers Excel
 *
 * IMPORTANT :
 * Remplacer getAuthenticatedUser() par la vérification
 * réelle de la session de connexion d'IA Exel.
 */

// Vérification provisoire : refuse tout utilisateur
// tant que l'authentification réelle n'est pas intégrée.
async function getAuthenticatedUser(req) {
  // À remplacer par ton système de connexion actuel.
  return null;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];

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

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return jsonResponse(res, 400, {
        success: false,
        message: "Requête invalide."
      });
    }

    // Reconstituer une Request Web pour le SDK Vercel Blob.
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;

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

      // Cette fonction est exécutée avant la création
      // du jeton d'upload.
      onBeforeGenerateToken: async (pathname) => {
        const user = await getAuthenticatedUser(req);

        if (!user || !user.id) {
          throw new Error("Utilisateur non connecté.");
        }

        const userFolder = `users/${encodeURIComponent(user.id)}/`;

        // Chaque compte possède son propre dossier.
        if (!pathname.startsWith(userFolder)) {
          throw new Error("Chemin de dépôt non autorisé.");
        }

        const extension = pathname.toLowerCase();

        if (
          !extension.endsWith(".xlsx") &&
          !extension.endsWith(".xls")
        ) {
          throw new Error("Seuls les fichiers Excel sont acceptés.");
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false,

          // Identité conservée pour le traitement du callback.
          tokenPayload: JSON.stringify({
            userId: user.id
          })
        };
      },

      // Appelé après le dépôt réussi dans Vercel Blob.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const metadata = JSON.parse(tokenPayload || "{}");

        if (!metadata.userId) {
          throw new Error("Propriétaire du fichier introuvable.");
        }

        // À cette étape, nous pourrons enregistrer dans
        // la base de données le propriétaire, le nom,
        // le chemin Blob et la date du dépôt.
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
    console.error("Erreur API upload :", error.message);

    const message = error.message || "Échec du dépôt.";

    if (message.includes("connecté")) {
      return jsonResponse(res, 401, {
        success: false,
        message
      });
    }

    return jsonResponse(res, 400, {
      success: false,
      message
    });
  }
}
