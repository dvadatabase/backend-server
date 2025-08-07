import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { ddbClient } from "../config/awsConfig";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const PAYMENTLINKSTABLE = process.env.DYNAMODB_PAYMENT_LINKS_TABLE_NAME;

export const deletePaymentLink = async (
  chatroom_id: string,
  user_id: string
) => {
  const input = {
    TableName: PAYMENTLINKSTABLE,
    Key: {
      chatroom_id: { S: chatroom_id },
      user_id: { S: user_id },
    },
  };

  try {
    const command = new DeleteItemCommand(input);
    const response = await ddbClient.send(command);
  } catch (error) {
    console.error("ERROR: ", error);
  }
}; //END deletePaymentLink

export const getPaymentLinks = async (user_id: string) => {
  const input = {
    TableName: process.env.DYNAMODB_PAYMENT_LINKS_TABLE_NAME,
    IndexName: "user_id-index",
    KeyConditionExpression: "user_id = :user_id",
    ExpressionAttributeValues: {
      ":user_id": { S: user_id },
    },
  };
  try {
    const command = new QueryCommand(input);
    const response = await ddbClient.send(command);

    const rawItems = response.Items ?? [];
    const parsedItems = rawItems.map((item) => unmarshall(item));
    return parsedItems;
  } catch (error) {
    throw new Error(
      error.message || "Failed to get chatroom of specialist user"
    );
  }
}; //END getChatRoomOfOfflineUser

export const uploadPaymentLinks = async (
  payment_link: string,
  specialist_id: string,
  user_id: string,
  consultation_title: string,
  specialist_first_name: string,
  specialist_last_name: string,
  chatroom_id: string
) => {
  const input = {
    TableName: PAYMENTLINKSTABLE,
    Item: {
      payment_link: { S: payment_link },
      specialist_id: { S: specialist_id },
      user_id: { S: user_id },
      consultation_title: { S: consultation_title },
      specialist_first_name: { S: specialist_first_name },
      specialist_last_name: { S: specialist_last_name },
      chatroom_id: { S: chatroom_id },
    },
  };

  try {
    const command = new PutItemCommand(input);
    const response = await ddbClient.send(command);
  } catch (error) {
    console.error("UPLOAD PAYMENT LINKS ERROR: ", error);
  }
}; //END uploadPaymentLinks

export const fetchWorkingHours = async (email: string) => {
  const input = {
    TableName: process.env.DYNAMODB_SPECIALIST_WORKING_HOURS_TABLE_NAME,
    Key: {
      email: { S: email },
    },
  };

  try {
    const command = new GetItemCommand(input);
    const response = await ddbClient.send(command);
    const working_hours = response.Item.working_hours;
    return working_hours;
  } catch (error) {
    console.error("ERROR: ", error);
  }
}; //END fetchWorkingHours

export const uploadWorkingHoursToDB = async (
  email: string,
  working_hours: any[]
) => {
  const input = {
    TableName: process.env.DYNAMODB_SPECIALIST_WORKING_HOURS_TABLE_NAME,
    Item: marshall({
      email: email,
      working_hours: working_hours,
    }),
  };

  console.log("ITEM: ", input.Item.working_hours.L);

  try {
    const command = new PutItemCommand(input);
    const response = await ddbClient.send(command);

    return response.$metadata.httpStatusCode;
  } catch (error) {
    console.error("UPLOAD WORKING HOURS TO DB ERROR: ", error);
  }
}; //END uploadWorkingHoursToDB
