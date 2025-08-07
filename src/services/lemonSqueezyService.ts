import axios from "axios";
import dotenv from "dotenv";
import { uploadPaymentLinks } from "./dynamoDBService";

dotenv.config();

const LEMON_SQUEEZY_API_URL = process.env.LEMON_SQUEEZY_API_URL;
const API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
const STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID?.toString();
const VARIANT_ID = process.env.LEMON_SQUEEZY_VARIANT_ID?.toString();
const redirect_url = process.env.REDIRECT_URL;

export async function createCheckout(data: any) {
  console.log("API KEY: ", API_KEY);

  if (!STORE_ID || !VARIANT_ID || !API_KEY) {
    throw new Error("Missing required environment variables");
  }

  try {
    // Prepare the checkout data based on the provided structure
    const newCheckout = {
      productOptions: {
        name: "New Checkout Test", // Example product name
        description: "A new checkout test", // Example product description
      },
      checkoutOptions: {
        embed: true, // Example option: embed the checkout
        media: true, // Example option: include media
        logo: true, // Example option: include logo
      },
      checkoutData: {
        email: data.user_email, // Customer email
      },
      expiresAt: null, // Set expiration date if needed
      preview: true, // Preview mode (can be set to false for production)
      testMode: true, // Test mode (can be set to false for production)
    };

    const response = await axios.post(
      `${LEMON_SQUEEZY_API_URL}/checkouts`,
      {
        data: {
          type: "checkouts",
          attributes: {
            custom_price: data.specialist_price * 100, // Convert price to cents
            checkout_options: newCheckout.checkoutOptions, // Use the checkoutOptions object
            product_options: { redirect_url },
            checkout_data: {
              custom: {
                chatroomId: data.chatroomId,
                specialist_id: data.specialist_id,
                specialist_first_name: data.specialist_first_name,
                specialist_last_name: data.specialist_last_name,
                specialist_fcm_token: data.specialist_fcm_token,
                specialist_price: data.parsedPrice,
                specialist_profile_pic: data.specialist_profile_pic,
                user_id: data.user_id,
                user_first_name: data.user_first_name,
                user_email: data.user_email,
                user_fcm_token: data.user_fcm_token,
                user_profile_pic: data.user_profile_pic,
                consultation_title: data.consultation_title,
                consultation_details: data.consultation_details,
              },
            },
          },
          relationships: {
            store: {
              data: { type: "stores", id: STORE_ID },
            },
            variant: {
              data: { type: "variants", id: VARIANT_ID },
            },
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/vnd.api+json",
        },
      }
    );

    const paymentUrl = response.data.data.attributes.url;
    await uploadPaymentLinks(
      paymentUrl,
      data.specialist_id,
      data.user_id,
      data.consultation_title,
      data.specialist_first_name,
      data.specialist_last_name,
      data.chatroomId
    );
  } catch (error: any) {
    console.log("CREATE CHEKOUT ERROR: ");
    throw new Error("Failed to create checkout");
  }
}
