import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ReturnValue,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ddbClient } from "../config/awsConfig.js";
import admin from "../config/firebaseConfig.js";
import { format } from "date-fns";

// Constants
const CHAT_ROOM_TABLE_NAME = process.env.DYNAMODB_CHAT_ROOM_TABLE_NAME;
const MESSAGES_TABLE_NAME = process.env.DYNAMODB_MESSAGES_TABLE_NAME;
const OFFLINE_SPECIALISTS_TABLE_NAME =
  process.env.DYNAMODB_OFFLINE_SPECIALISTS_TABLE_NAME;

export const setUnreadFlag = async (
  room_id: string,
  set_unread: string,
  status: boolean
) => {
  const input = {
    TableName: CHAT_ROOM_TABLE_NAME,
    Key: { chat_room_id: { S: room_id } },
    UpdateExpression: "SET #field = :trueVal",
    ExpressionAttributeNames: {
      "#field": set_unread,
    },
    ExpressionAttributeValues: {
      ":trueVal": { BOOL: status },
    },
  };

  try {
    const command = new UpdateItemCommand(input);
    const response = await ddbClient.send(command);
  } catch (error) {
    console.error("ERROR SETTING UNREAD FLAG: ", error);
  }
}; //END setUnreadFlag

export const getNewMessagesFromDB = async (
  room_id: string,
  last_timestamp: string
) => {
  const input: any = {
    TableName: MESSAGES_TABLE_NAME,
    IndexName: "room_id-timestamp-index",
    KeyConditionExpression:
      "room_id = :room_id AND #timestamp >= :last_timestamp",
    ExpressionAttributeValues: {
      ":room_id": { S: room_id },
      ":last_timestamp": { S: last_timestamp },
    },
    ExpressionAttributeNames: { "#timestamp": "timestamp" },
    ScanIndexForward: true,
  };

  try {
    const command = new QueryCommand(input);
    const data = await ddbClient.send(command);

    return data;
  } catch (error) {
    console.error("ERROR FETCHING NEW MESSAGES: ", error);
    return;
  }
}; //END getNewMessagesFromDynamoDB

export const getChatRoomOfOfflineSpecialist = async (specialist_id: string) => {
  const input = {
    TableName: OFFLINE_SPECIALISTS_TABLE_NAME,
    KeyConditionExpression: "specialist_id = :specialist_id",
    ExpressionAttributeValues: {
      ":specialist_id": { S: specialist_id },
    },
  };
  try {
    const command = new QueryCommand(input);
    const response = await ddbClient.send(command);

    if (response.Items && response.Items.length > 0) {
      const chatRooms: any[] = [];

      for (const item of response.Items) {
        if (!item.chat_room_data || !item.chat_room_data.S) {
          console.warn("Skipping invalid item: ", item);
          continue;
        }

        const chatRoomData = JSON.parse(item.chat_room_data.S);
        chatRooms.push(chatRoomData);

        const delete_input = {
          TableName: OFFLINE_SPECIALISTS_TABLE_NAME,
          Key: {
            specialist_id: { S: specialist_id },
            chat_room_id: { S: item.chat_room_id.S },
          },
        };

        try {
          await ddbClient.send(new DeleteItemCommand(delete_input));
        } catch (error) {
          throw new Error("An Error Occurred");
        }
      }

      return chatRooms;
    } else {
      return [];
    }
  } catch (error) {
    return "Token Expired";
  }
}; //END getChatRoomOfOfflineUser

export const saveChatRoomForOfflineSpecialist = async (
  specialist_id: string,
  chat_room_id: string,
  chat_room_data: any
) => {
  const input = {
    TableName: OFFLINE_SPECIALISTS_TABLE_NAME,
    Item: {
      specialist_id: { S: specialist_id },
      chat_room_id: { S: chat_room_id },
      chat_room_data: { S: JSON.stringify(chat_room_data) },
      timestamp: { S: new Date().toISOString() },
    },
  };

  try {
    const command = new PutItemCommand(input);
    await ddbClient.send(command);
  } catch (error) {
    console.error("SAVE CHATROOM OF OFFLINE USER ERROR: ", error);
  }
}; //END saveChatRoomForOfflineUser

//Close Chat Room
export const closeChatRoom = async (room_id: string) => {
  const input = {
    TableName: CHAT_ROOM_TABLE_NAME,
    Key: {
      "chat_room_id": { S: room_id },
    },
    UpdateExpression: "SET #status = :newStatus",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":newStatus": { S: "closed" },
    },
    ReturnValues: ReturnValue.UPDATED_NEW,
  };

  try {
    const command = new UpdateItemCommand(input);
    const response = await ddbClient.send(command);
    const data = response.Attributes.status.S;

    return data;
  } catch (error) {
    console.error("ERROR CLOSING CHAT ROOM: ", error);
  }
}; //END closeChatRoom

//Get status of chat room
export const getChatRoomStatus = async (room_id: string) => {
  const params = {
    TableName: CHAT_ROOM_TABLE_NAME,
    Key: {
      chat_room_id: { S: room_id },
    },
    AttributesToGet: ["status"],
  };

  try {
    const command = new GetItemCommand(params);
    const result = await ddbClient.send(command);

    return result.Item.status.S;
  } catch (error) {
    console.error("ERROR GETTING CHAT ROOM STATUS: ", error);
  }
}; //END getChatRoomStatus

//Get chats to room from DynamoDB
export const getMessagesFromDB = async (room_id: string) => {
  const input = {
    TableName: MESSAGES_TABLE_NAME,
    KeyConditionExpression: "room_id = :room_id",
    ExpressionAttributeValues: {
      ":room_id": { S: room_id },
    },
  };

  try {
    const command = new QueryCommand(input);
    const result = await ddbClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error("Error fetching messages: ", error);
    throw new Error("Failed to fetch messages.");
  }
}; //END getMessagesFromDB

// Save a chat room to DynamoDB
export const saveChatRoomToDB = async (
  chatroomId: string,
  specialist_id: string,
  specialist_first_name: string,
  specialist_profile_pic: string,
  user_id: string,
  user_first_name: string,
  user_profile_pic: string,
  consultation_title: string,
  specialist_fcm_token: string,
  user_fcm_token: string,
  consultation_details: string
): Promise<void> => {
  const params = {
    TableName: CHAT_ROOM_TABLE_NAME,
    Item: {
      chat_room_id: { S: chatroomId },
      status: { S: "open" },
      specialist_id: { S: specialist_id },
      specialist_first_name: { S: specialist_first_name },
      specialist_profile_pic: { S: specialist_profile_pic },
      user_id: { S: user_id },
      user_first_name: { S: user_first_name },
      user_profile_pic: { S: user_profile_pic },
      consultation_title: { S: consultation_title },
      specialist_fcm_token: { S: specialist_fcm_token },
      user_fcm_token: { S: user_fcm_token },
      createdAt: { S: new Date().toISOString() },
      consultation_details: { S: consultation_details },
    },
  };

  try {
    const command = new PutItemCommand(params);
    const response = await ddbClient.send(command);

    console.log("CAHT ROOM DB: ", params);
  } catch (error) {
    console.error("Error saving chatroom to DynamoDB:", error);
    throw new Error("Failed to save chatroom");
  }
};

// Get chat rooms from DynamoDB
export const getChatRoomsFromDB = async (
  user_role: string,
  user_id: string
): Promise<any> => {
  if (user_role === "specialist") {
    const results = [];

    try {
      // First, query by specialist_id
      const specialistParams = {
        TableName: CHAT_ROOM_TABLE_NAME,
        IndexName: "specialist_id-status-index",
        KeyConditionExpression: "specialist_id = :id",
        ExpressionAttributeValues: {
          ":id": { S: user_id },
        },
      };
      const specialistCommand = new QueryCommand(specialistParams);
      const specialistResult = await ddbClient.send(specialistCommand);
      results.push(...(specialistResult.Items || []));

      // Then, query by user_id
      const userParams = {
        TableName: CHAT_ROOM_TABLE_NAME,
        IndexName: "user_id-status-index",
        KeyConditionExpression: "user_id = :id",
        ExpressionAttributeValues: {
          ":id": { S: user_id },
        },
      };
      const userCommand = new QueryCommand(userParams);
      const userResult = await ddbClient.send(userCommand);
      results.push(...(userResult.Items || []));

      return results;
    } catch (error) {
      console.error("Error fetching chatrooms for specialist:", error);
      throw new Error("Failed to fetch specialist chatrooms");
    }
  } else {
    const params = {
      TableName: CHAT_ROOM_TABLE_NAME,
      IndexName: "user_id-status-index",
      KeyConditionExpression: "user_id = :user_id",
      ExpressionAttributeValues: {
        ":user_id": { S: user_id }, // User ID
      },
    };

    try {
      const command = new QueryCommand(params);
      return await ddbClient.send(command);
    } catch (error) {
      console.error(
        `Error fetching chatrooms for user ${CHAT_ROOM_TABLE_NAME}:`,
        error
      );
      throw new Error("Failed to fetch user chatrooms");
    }
  }
};

// Store a message in DynamoDB
export const storeMessageInDB = async (
  room_id: string,
  sender_id: string,
  message: string,
  media_url: string,
  message_type: string,
  timestamp: string,
  message_id: string
): Promise<void> => {
  const params = {
    TableName: MESSAGES_TABLE_NAME,
    Item: {
      message_id: { S: message_id },
      room_id: { S: room_id },
      sender_id: { S: sender_id },
      message: { S: message },
      media_url: { S: media_url },
      message_type: { S: message_type },
      timestamp: { S: timestamp },
      status: { S: "unread" },
    },
  };

  try {
    const command = new PutItemCommand(params);
    await ddbClient.send(command);
  } catch (error) {
    console.error("Error storing message in DB:", error);
    throw new Error("Failed to store message");
  }
};

// Get users of a specific chat room
export const getRoomUsers = async (
  room_id: string
): Promise<{ user1: { S: string }; user2: { S: string } }> => {
  const params = {
    TableName: CHAT_ROOM_TABLE_NAME,
    Key: {
      chat_room_id: { S: room_id },
    },
  };

  try {
    const command = new GetItemCommand(params);
    const result = await ddbClient.send(command);

    if (!result.Item) {
      throw new Error(`Room ${room_id} not found`);
    }

    const { user_id, specialist_id } = result.Item;

    // Ensure user_id and specialist_id are not undefined
    if (!user_id || !specialist_id) {
      throw new Error(
        `User ID or Specialist ID is missing for room ${room_id}`
      );
    }

    // Safely handle undefined values for user_id and specialist_id
    const user1 = user_id?.S ? user_id.S : "";
    const user2 = specialist_id?.S ? specialist_id.S : "";

    if (!user1 || !user2) {
      throw new Error("Invalid user or specialist ID");
    }

    return { user1: { S: user1 }, user2: { S: user2 } };
  } catch (error) {
    console.error("Error fetching room users:", error);
    throw new Error("Failed to fetch room users");
  }
};

// Placeholder for sending notifications
export const sendNotification = async (
  fcm_token: string,
  notification: { title: string; body: string }
): Promise<void> => {
  try {
    if (!fcm_token) throw new Error("Recipient FCM token required");

    const message = {
      token: fcm_token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
    };

    await admin.messaging().send(message);
  } catch (error) {
    console.error("Failed to send push notification: ", error);
    throw new Error("Error sending push notification");
  }
};
