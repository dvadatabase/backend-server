import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./.env" });

// Ensure environment variables are defined
const REGION = process.env.AWS_REGION;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
if (!REGION || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  throw new Error("AWS credentials is not defined in environment variables.");
}

// Initialize the AWS SDK clients with types
const ddbClient = new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID as string,
    secretAccessKey: SECRET_ACCESS_KEY as string,
  },
});
const cognito = new CognitoIdentityProvider({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID as string,
    secretAccessKey: SECRET_ACCESS_KEY as string,
  },
});
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID as string,
    secretAccessKey: SECRET_ACCESS_KEY as string,
  },
});

// Export the clients to use in other modules
export { ddbClient, cognito, s3 };
