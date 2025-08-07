import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "../config/awsConfig";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const getSpecialistDocuments = async (email: string) => {
  const input = {
    Bucket: process.env.CREDENTIALSBUCKET,
    Prefix: `${email}/Diplomas/`,
  };

  try {
    const command = new ListObjectsV2Command(input);
    const response = await s3.send(command);

    // Map the documents to include the URL
    const documents = response.Contents?.map((item) => {
      const documentName = item.Key?.split("/").pop(); // Get the file name
      const url = `https://${process.env.CREDENTIALSBUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`;
      return { name: documentName, url };
    });

    return documents || [];
  } catch (error) {
    console.error("DOCUMENTS ERROR: ", error);
  }
}; //END getSpecialistDocuments

export const uploadMediaToS3 = async (
  bucket: string,
  key: string,
  content_type: string
) => {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
      ContentType: content_type,
    };

    const command = new PutObjectCommand(params);
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes validity

    return presignedUrl;
  } catch (error) {
    console.error("S3 PRESIGNED URL ERROR:", error);
    throw new Error("Failed to generate pre-signed URL");
  }
}; //END uploadMediaToS3

export const deleteCredentialsFromS3 = async (email: string) => {
  const input = {
    Bucket: process.env.CREDENTIALSBUCKET,
    Key: email,
  };

  try {
    const command = new DeleteObjectCommand(input);
    const response = await s3.send(command);
  } catch (error) {}
}; //END deleteCredentialsFromS3
