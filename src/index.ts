import dotenv from "dotenv";
dotenv.config();
import { Server } from "socket.io";
import {
  handleCreateChatRoomFromPayment,
  initializeSocket,
} from "./socket/chatSocket";
import express from "express";
import cors from "cors";
import {
  signIn,
  refreshTokens,
  forgotPassword,
  changeForgottenPassword,
  changePassword,
  uploadFcmToken,
  signOut,
  deleteFcmToken,
  getFcmToken,
  deleteAccount,
  signUp,
  sendCode,
  confirmAccount,
  checkUser,
  getSpecialists,
  getUserAttributes,
  updateUserAttributes,
  isUserRegistered,
  checkIfAccountExists,
} from "./services/cognitoService";
import {
  deleteCredentialsFromS3,
  getSpecialistDocuments,
} from "./services/s3Service";
import { getNewMessagesFromDB } from "./services/chatroomService";
import webhooksRoutes from "./payments/paymentController";
import nodemailer from "nodemailer";
import {
  deletePaymentLink,
  fetchWorkingHours,
  getPaymentLinks,
  uploadWorkingHoursToDB,
} from "./services/dynamoDBService";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const IP = process.env.LOCAL_TESTING_IP;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
// app.use(
//   cors({
//     origin: [`${IP}:8100`, `${IP}:8101`], // Trusted domains
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type"],
//   })
// );

app.post("/CreateChatRoomTemp", async (req, res) => {
  const { data } = req.body;

  if (!data) return res.status(400).json({ error: "Missing Data" });

  try {
    await handleCreateChatRoomFromPayment(data);
    res.status(200).json({ message: "Chat Room Created" });
  } catch (error) {
    console.error("CREATE CHAT TOOM TEMP ERROR: ", error);
    res.status(400).json({ error: "Error creating chat room" });
  }
});

app.get("/checkIfUserExists", async (req, res) => {
  const { account_id } = req.query;

  if (!account_id) return res.status(400).json({ error: "ID is required" });

  try {
    const data = await checkIfAccountExists(account_id as string);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error checking user: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/deletePaymentLink", async (req, res) => {
  const { chatroom_id, user_id } = req.body;

  if (!chatroom_id || !user_id)
    return res.status(400).json({ error: "Missing Data" });

  try {
    await deletePaymentLink(chatroom_id as string, user_id);
    res.status(200).json({ message: "Link deleted" });
  } catch (error) {
    res.status(400).json({ error: "Error deleting link" });
  }
});

app.get("/getPaymentLinks", async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    const data = await getPaymentLinks(user_id as string);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching payment links: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.use("/webhooks", webhooksRoutes);

app.post("/getWorkingHours", async (req, res) => {
  const email = req.body.email;

  if (!email) return res.status(400).json({ message: "Invalid request" });

  try {
    const response = await fetchWorkingHours(email);
    res.status(200).json({ message: response || "DATA FETCHED" });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch working hours" });
  }
});

app.post("/checkIfRegistered", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Invalid request" });

  try {
    const response = await isUserRegistered(email);
    res.status(200).json({ message: response || "User Registered" });
  } catch (error) {
    res.status(500).json({ message: "Failed to check user" });
  }
});

app.post("/uploadWorkingHours", async (req, res) => {
  const { email, working_hours } = req.body;

  if (!email || !Array.isArray(working_hours))
    return res.status(400).json({ message: "Invalid request" });

  try {
    const response = await uploadWorkingHoursToDB(email, working_hours);
    res.status(200).json({ message: response || "Working Hours Uploaded" });
  } catch (error) {
    res.status(500).json({ message: "Failed to upload working hours" });
  }
});

app.post("/auth/updateAttributes", async (req, res) => {
  const { access_token, new_attributes } = req.body;

  try {
    const response = await updateUserAttributes(access_token, new_attributes);
    res.status(200).json({ message: response });
  } catch (error) {
    console.error("UPDATE USER ATTRIBUTES ERROR: ", error.message);
    res
      .status(400)
      .json({ message: error.message || "Failed to update attributes" });
  }
});

app.post("/auth/getAttributes", async (req, res) => {
  const { access_token } = req.body;

  if (!access_token)
    return res.status(400).json({ message: "Missing Access Token" });

  try {
    const response = await getUserAttributes(access_token);
    return res.status(200).json({ message: response });
  } catch (error) {
    return res.status(400).json({ message: "Error getting attributes" });
  }
});

app.post("/sendForm", async (req, res) => {
  const { name, email, subject, message } = req.body;

  const transporter = nodemailer.createTransport({
    host: "email-smtp.eu-central-1.amazonaws.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.AWS_SES_SMTP_USERNAME,
      pass: process.env.AWS_SES_SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: "dva.app@outlook.com", // Must be a verified email in SES
    to: "dva.app2023@gmail.com",
    subject: `${subject} From Name: ${name} With Email: ${email}`,
    text: message,
  };

  try {
    transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    res.status(400).json({ message: "Failed to send message" });
  }
});

app.get("/getNewMessages", async (req, res) => {
  const { room_id, last_timestamp } = req.query;

  if (!room_id) return res.status(400).json({ error: "room_id is required" });

  try {
    const data = await getNewMessagesFromDB(
      room_id as string,
      last_timestamp as string
    );
    res.json({ messages: data.Items || [] });
  } catch (error) {
    console.error("Error fetching new messages: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/getDocuments", async (req, res) => {
  const { email } = req.body;

  try {
    const data = await getSpecialistDocuments(email);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//delete S3
app.post("/deleteS3", async (req, res) => {
  const { email } = req.body;

  try {
    const data = await deleteCredentialsFromS3(email);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Check User
app.post("/auth/checkUser", async (req, res) => {
  const { username, password } = req.body;

  try {
    const data = await checkUser(username, password);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Confirm Account
app.post("/auth/confirmAccount", async (req, res) => {
  const { username, confirmation_code } = req.body;

  try {
    const data = await confirmAccount(username, confirmation_code);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Send Code
app.post("/auth/sendCode", async (req, res) => {
  const { username } = req.body;

  try {
    const data = await sendCode(username);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Sign Up
app.post("/auth/signup", async (req, res) => {
  const {
    password,
    email,
    first_name,
    last_name,
    country,
    birthdate,
    gender,
    is_specialist,
    specialties,
    local_price,
    international_price,
    profile_pic,
    paypal_email,
  } = req.body;

  try {
    const data = await signUp(
      password,
      email,
      first_name,
      last_name,
      country,
      birthdate,
      gender,
      is_specialist,
      specialties,
      local_price,
      international_price,
      profile_pic,
      paypal_email
    );
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
    console.error("ERROR: ", error);
  }
});

//Delete Account
app.post("/auth/deleteAccount", async (req, res) => {
  const { username, password } = req.body;

  try {
    const data = await deleteAccount(username, password);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Get FCM Token
app.post("/auth/getFcmToken", async (req, res) => {
  const { specialist_user_id } = req.body;

  try {
    const data = await getFcmToken(specialist_user_id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Upload FCM Token
app.post("/auth/uploadFcmToken", async (req, res) => {
  const { user_id, fcm_token } = req.body;

  try {
    const data = await uploadFcmToken(user_id, fcm_token);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Delete FCM Token
app.post("/auth/deleteFcmToken", async (req, res) => {
  const { user_id } = req.body;

  try {
    const data = await deleteFcmToken(user_id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Sign Out
app.post("/auth/signout", async (req, res) => {
  const { access_token } = req.body;

  if (!access_token) return res.status(400).json({ message: "Token Required" });

  try {
    const data = await signOut(access_token);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Change Password
app.post("/auth/changePassword", async (req, res) => {
  const { username, previous_password, new_password } = req.body;

  try {
    const data = await changePassword(
      username,
      previous_password,
      new_password
    );
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Change Forgotten Password
app.post("/auth/changeForgottenPassword", async (req, res) => {
  const { confirmation_code, username, password } = req.body;

  try {
    const data = await changeForgottenPassword(
      confirmation_code,
      username,
      password
    );
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Forgot Password
app.post("/auth/forgotPassword", async (req, res) => {
  const { username } = req.body;

  try {
    const data = await forgotPassword(username);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Refresh Tokens
app.post("/auth/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  try {
    const tokens = await refreshTokens(refresh_token);
    res.json(tokens);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Sign In
app.post("/auth/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const authData = await signIn(email, password);

    res.json(authData);
  } catch (error: any) {
    console.log("ERROR: ", error);

    res.status(400).json({
      code: error.code || "UnknownError",
      message: error.message || "Sign in failed.",
    });
  }
});

// Route: Get Specialists
app.get("/getSpecialists", async (req, res) => {
  try {
    // Ensure `limit` and `offset` are converted to numbers
    const { limit = "4", offset = "0" } = req.query;

    // Convert `limit` and `offset` to numbers
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    // Fetch all users from Cognito
    const allUsers = await getSpecialists();

    // Pagination logic
    const paginatedUsers = allUsers.slice(
      parsedOffset,
      parsedOffset + parsedLimit
    );

    // Format user data
    const formattedUsers = paginatedUsers.map((user) => ({
      id: user.Attributes.sub,
      email: user.Attributes.email,
      family_name: user.Attributes.family_name,
      given_name: user.Attributes.given_name,
      specialties: user.Attributes["custom:specialties"],
      localPrice: user.Attributes["custom:local_price"],
      profile_pic: user.Attributes["custom:profile_pic"],
    }));

    // Respond with users and total count
    res.status(200).json({ Users: formattedUsers, total: allUsers.length });
  } catch (error) {
    console.error("Error fetching specialists:", error);
    res.status(500).json({ error: "Failed to get users from Cognito" });
  }
});

const EC2IP = "0.0.0.0";
// Start HTTP Server
const httpServer = app.listen(PORT, EC2IP, () => {
  console.log(`HTTP server running on ${IP}:${PORT}`);
});

// Initialize Socket.IO server
const io = new Server(httpServer, {
  cors: { origin: "*" }, // Adjust for production
});

// Log Socket.IO server initialization
console.log(`Socket.IO server running on port ${PORT}`);

// Initialize Socket.IO events
initializeSocket(io);
