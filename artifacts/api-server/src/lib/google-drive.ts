import { google } from "googleapis";
import { Readable } from "stream";
import { logger } from "./logger.js";

// Load Google Service Account JSON from env
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

// Folder IDs from configuration or user input
const PROFILE_FOLDER_ID = "1J-ukknloBtc3Dw3Ua1yc5Hy3BxQf8FgJ";
const EXPENSE_FOLDER_ID = "1AnsrP9FZRs2y00umK7fGatBbDVXL2qIr";

let driveClient: any = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    logger.warn("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not defined. Google Drive uploads will be disabled, falling back to base64 DB storage.");
    return null;
  }

  try {
    let credentials;
    const trimmedKey = GOOGLE_SERVICE_ACCOUNT_KEY.trim();
    if (trimmedKey.startsWith("{")) {
      credentials = JSON.parse(trimmedKey);
    } else {
      throw new Error("Expected service account JSON string starting with '{'. Please paste the JSON key content.");
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    driveClient = google.drive({ version: "v3", auth });
    return driveClient;
  } catch (error) {
    logger.error({ err: error as Error }, "Failed to initialize Google Drive client");
    return null;
  }
}

/**
 * Parses a base64 data URI into a Buffer and MimeType
 */
function parseBase64Data(dataURI: string) {
  const matches = dataURI.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 data URI format");
  }
  return {
    mimeType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
}

/**
 * Uploads a base64 file to Google Drive and returns a viewing link.
 * Falls back to returning the base64 string if Google Drive is not configured.
 */
export async function uploadToGoogleDrive(
  dataURI: string | null | undefined,
  type: "profile" | "expense",
  fileName: string
): Promise<string | null> {
  if (!dataURI) return null;

  // If the data URI is not a base64 data URI (e.g. already a URL), return as-is
  if (!dataURI.startsWith("data:")) {
    return dataURI;
  }

  const drive = getDriveClient();
  if (!drive) {
    logger.warn("Google Drive client not initialized. Storing base64 directly in database as fallback.");
    return dataURI;
  }

  try {
    const { mimeType, buffer } = parseBase64Data(dataURI);
    const folderId = type === "profile" ? PROFILE_FOLDER_ID : EXPENSE_FOLDER_ID;

    // Create readable stream from buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    logger.info(`Uploading file '${fileName}' to Google Drive folder: ${folderId}`);

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body: stream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Failed to retrieve file ID from Google Drive response");
    }

    logger.info(`File uploaded successfully to Google Drive. File ID: ${fileId}`);

    // Make file public-readable so it can be viewed directly
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
      logger.info(`Permission set to 'anyone' reader for file ID: ${fileId}`);
    } catch (permError) {
      logger.error({ err: permError as Error }, "Failed to set public permission on Google Drive file");
    }

    // Direct image embed/view link format
    const directViewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return directViewUrl;
  } catch (error: any) {
    logger.error("Failed to upload file to Google Drive: %s", error.message || error);
    // Fallback to storing base64 so user doesn't lose the file/operation
    return dataURI;
  }
}
