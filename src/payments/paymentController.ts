import express from "express";
import crypto from "crypto";
import {
  handleCreateChatRoomFromPayment,
  ioInstance,
} from "../socket/chatSocket";
import { deletePaymentLink } from "../services/dynamoDBService";

const router = express.Router();

// Handle the POST request for webhooks
router.post("/lemon", express.json(), async (req, res) => {
  const eventName = req.body?.meta?.event_name;
  const paymentUrl = req.body?.data?.attributes;

  if (eventName !== "order_created") {
    return res.status(200).send("Event ignored");
  }

  try {
    const customData = req.body?.meta?.custom_data;

    if (
      !customData.user_id ||
      !customData.specialist_id ||
      !customData.chatroomId ||
      !customData.user_fcm_token ||
      !customData.user_first_name ||
      !customData.consultation_title ||
      !customData.consultation_details ||
      !customData.specialist_fcm_token ||
      !customData.specialist_last_name ||
      !customData.specialist_first_name
    ) {
      return res.status(400).send("Missing required custom data");
    }

    const {
      user_id,
      specialist_id,
      chatroomId,
      user_fcm_token,
      user_first_name,
      consultation_title,
      consultation_details,
      specialist_fcm_token,
      specialist_last_name,
      specialist_first_name,
      specialist_profile_pic,
      user_profile_pic,
    } = customData;

    const data = {
      chatroomId: chatroomId,
      specialist_id: specialist_id,
      specialist_first_name: specialist_first_name,
      specialist_profile_pic: specialist_profile_pic,
      user_id: user_id,
      user_first_name: user_first_name,
      user_profile_pic: user_profile_pic,
      consultation_title: consultation_title,
      specialist_fcm_token: specialist_fcm_token,
      user_fcm_token: user_fcm_token,
      consultation_details: consultation_details,
    };

    await handleCreateChatRoomFromPayment(data);
    await deletePaymentLink(chatroomId, user_id);

    return res.status(200).send({ data });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send("Internal Server Error");
  }
});

export default router;
