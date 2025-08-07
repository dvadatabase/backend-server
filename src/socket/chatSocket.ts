import { Server, Socket } from "socket.io";
import {
  saveChatRoomToDB,
  getChatRoomsFromDB,
  storeMessageInDB,
  getRoomUsers,
  sendNotification,
  getMessagesFromDB,
  getChatRoomStatus,
  closeChatRoom,
  getChatRoomOfOfflineSpecialist,
  saveChatRoomForOfflineSpecialist,
  setUnreadFlag,
} from "../services/chatroomService";
import { uploadMediaToS3 } from "../services/s3Service";
import { createCheckout } from "../services/lemonSqueezyService";
import axios from "axios";

export let ioInstance: Server;
const userSockets = new Map<string, string>();

export const handleCreateChatRoomFromPayment = async (data: any) => {
  try {
    await saveChatRoomToDB(
      data.chatroomId,
      data.specialist_id,
      data.specialist_first_name,
      data.specialist_profile_pic,
      data.user_id,
      data.user_first_name,
      data.user_profile_pic,
      data.consultation_title,
      data.specialist_fcm_token,
      data.user_fcm_token,
      data.consultation_details
    );

    const user_socket_id = userSockets.get(data.user_id);
    const specialist_socket_id = userSockets.get(data.specialist_id);

    ioInstance.to(user_socket_id).emit("saveChatRoom", data);

    if (specialist_socket_id)
      ioInstance.to(specialist_socket_id).emit("saveChatRoom", data);
    else
      saveChatRoomForOfflineSpecialist(
        data.specialist_id,
        data.chatroomId,
        data
      );
  } catch (error) {
    console.error("Error creating chatroom from payment:", error);
  }
};

export const initializeSocket = (io: Server) => {
  ioInstance = io;

  io.on("connection", (socket: Socket) => {
    socket.on("sendPaymentLink", async (data) => {
      const {
        chatroomId,
        specialist_id,
        specialist_first_name,
        specialist_last_name,
        specialist_fcm_token,
        specialist_price,
        specialist_profile_pic,
        user_id,
        user_first_name,
        user_fcm_token,
        user_profile_pic,
        consultation_title,
        consultation_details,
      } = data.data;

      try {
        const parsedPrice = Number(specialist_price);
        const attr = {
          chatroomId: chatroomId,
          specialist_id: specialist_id,
          specialist_first_name: specialist_first_name,
          specialist_last_name: specialist_last_name,
          specialist_fcm_token: specialist_fcm_token,
          specialist_price: parsedPrice,
          specialist_profile_pic: specialist_profile_pic,
          user_id: user_id,
          user_first_name: user_first_name,
          user_fcm_token: user_fcm_token,
          user_profile_pic: user_profile_pic,
          consultation_title: consultation_title,
          consultation_details: consultation_details,
        };
        console.log("ATTR: ", attr);
        const link = await createCheckout(attr);
        const user_socket_id = userSockets.get(user_id);
        if (user_socket_id) {
          io.to(user_socket_id).emit("getPaymentLink", {
            link,
            consultation_title,
            specialist_first_name,
            specialist_last_name,
          });
        } else {
          console.error(`User socket not found for user_id: ${user_id}`);
        }
      } catch (error) {
        console.error("Error creating checkout or emitting link:", error);
        const user_socket_id = userSockets.get(user_id);
        if (user_socket_id) {
          io.to(user_socket_id).emit("paymentError", {
            message: "Failed to create checkout link",
          });
        }
      }
    });

    socket.on(
      "registerUser",
      async (user_id: string, callback: (response: any) => void) => {
        if (user_id) {
          userSockets.set(user_id, socket.id);
          socket.join(user_id);

          let chat_rooms = await getChatRoomOfOfflineSpecialist(user_id);
          if (chat_rooms === "Token Expired") {
            callback("Token Expired");
            return;
          } else {
            if (Array.isArray(chat_rooms) && chat_rooms.length > 0) {
              chat_rooms.forEach((chat_room: any) => {
                io.to(user_id).emit("saveChatRoom", chat_room);
              });
            }
          }
        }
      }
    );

    socket.on(
      "getPresignedUrl",
      async ({ bucket, key, content_type }, callback) => {
        try {
          if (!bucket || !key || !content_type) {
            return callback({
              success: false,
              error: "Missing required fields",
            });
          }

          const presignedUrl = await uploadMediaToS3(bucket, key, content_type);

          callback({ success: true, presignedUrl });
        } catch (error) {
          console.error("PRESIGNED URL ERROR:", error);
          callback({ success: false, error: error.message });
        }
      }
    );

    socket.on("closeChatRoom", async (room_id) => {
      try {
        const data = await closeChatRoom(room_id.room_id);

        io.to(room_id.room_id).emit("chatRoomClosed", {
          room_id,
          status: "closed",
        });

        socket.emit("chatRoomClosed", data);
      } catch (error) {
        console.error("ERROR SOCKET GET CHAT ROOM STATUS: ", error);
      }
    });

    socket.on("getChatRoomStatus", async (room_id) => {
      try {
        const data = await getChatRoomStatus(room_id.room_id);
        socket.emit("chatRoomStatusResponse", data);
      } catch (error) {
        console.error("ERROR SOCKET GET CHAT ROOM STATUS: ", error);
      }
    });

    // Event: Get chatrooms
    socket.on("getChatRooms", async (data) => {
      const { user_role, user_id } = data;

      try {
        const chatRooms = await getChatRoomsFromDB(user_role, user_id);

        let normalizedItems: any[] = [];

        if (Array.isArray(chatRooms)) {
          normalizedItems = chatRooms;
        } else if (chatRooms && Array.isArray(chatRooms.Items)) {
          normalizedItems = chatRooms.Items;
        }

        socket.emit("chatRoomsResponse", { Items: normalizedItems });
      } catch (error) {
        console.error("Error fetching chatrooms:", error);
        socket.emit("error", { message: "Failed to fetch chatrooms." });
      }
    });

    // Event: Join a chatroom
    socket.on(
      "joinChatRoom",
      async ({ room_id, user_id, first_name, fcm_token, user_type }) => {
        try {
          socket.data.user_id = user_id;
          socket.join(room_id);

          getMessagesFromDB(room_id).then((messages: any) => {
            socket.emit("previousMessages", messages);
          });

          const status = await getChatRoomStatus(room_id);

          setUnreadFlag(room_id, user_type, false);

          socket.emit("joinedRoom", {
            success: true,
            room_id,
            first_name,
            fcm_token,
            status,
          });
        } catch (error) {
          console.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join chatroom." });
        }
      }
    );

    // Event: Send message to a chatroom
    socket.on(
      "sendMessageToRoom",
      async ({
        room,
        message,
        media_url,
        message_type,
        sender_id,
        sender_name,
        fcm_token,
        timestamp,
        message_id,
        set_unread,
      }) => {
        try {
          await setUnreadFlag(room, set_unread, true);
          await storeMessageInDB(
            room,
            sender_id,
            message,
            media_url,
            message_type,
            timestamp,
            message_id
          );

          const { user1, user2 } = await getRoomUsers(room);
          const user1_id = user1?.S;
          const user2_id = user2?.S;
          const recipient_id = user1_id === sender_id ? user2_id : user1_id;

          io.to(recipient_id).emit("receiveMessage2", {
            message,
            sender: sender_name,
            timestamp: timestamp,
            media_url,
            message_type,
            room,
            sender_id,
          });

          socket.broadcast.to(room).emit("receiveMessage", {
            message,
            sender: sender_name,
            timestamp: timestamp,
            media_url,
            message_type,
            room,
          });

          const socketsInRoom = await io.in(room).fetchSockets();
          const isRecipientInRoom = socketsInRoom.some(
            (s) => s.data.user_id === recipient_id
          );

          const msg_type = message_type.split("/")[0];
          if (!isRecipientInRoom) {
            const notification_title = media_url
              ? `New ${msg_type} from ${sender_name}`
              : `New message from ${sender_name}`;

            await sendNotification(fcm_token, {
              title: notification_title,
              body: message,
            });
          }
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("messageSendError", {
            message: "Failed to send message.",
          });
        }
      }
    );

    // Event: Leave a chatroom
    socket.on("leaveChatRoom", ({ room_id }) => {
      try {
        socket.leave(room_id);
      } catch (error) {
        console.error("Error leaving room:", error);
        socket.emit("error", { message: "Failed to leave chatroom." });
      }
    });

    // Event: Handle client disconnect
    socket.on("disconnect", () => {
      for (const [userId, storedSocketId] of userSockets.entries()) {
        if (storedSocketId === socket.id) {
          userSockets.delete(userId);

          break;
        }
      }
      socket.rooms.forEach((room_id) => {
        socket.leave(room_id);
      });
    });
  });
};
