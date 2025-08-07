import {
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AuthFlowType,
  ChangePasswordCommand,
  CognitoIdentityProvider,
  CognitoIdentityProviderServiceException,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DeleteUserCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognito, ddbClient } from "../config/awsConfig";
import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

// Define a type for the user attributes to ensure proper typing
interface UserAttributes {
  [key: string]: string;
}

// Define the shape of the user object
interface Specialist {
  Attributes: UserAttributes;
}

const USERPOOL_ID = process.env.USERPOOLID;

//---------------------------------------------------------------------------------

export const getUserType = async (email: string) => {
  const input = {
    UserPoolId: USERPOOL_ID,
    Filter: `email = "${email}"`,
  };

  try {
    const command = new ListUsersCommand(input);
    const response = await cognito.send(command);

    const attributes = response.Users[0].Attributes;
    const isSpecialistAttr = attributes.find(
      (attr) => attr.Name === "custom:is_specialist"
    );
    return isSpecialistAttr;
  } catch (error) {}
}; //END getUserType

export const checkIfAccountExists = async (account_id: string) => {
  const input = {
    UserPoolId: USERPOOL_ID,
    Username: account_id,
  };

  try {
    const command = new AdminGetUserCommand(input);
    const response = await cognito.send(command);

    return response.UserStatus;
  } catch (error) {}
}; //END checkIfSpecialistExists

export const isUserRegistered = async (email: string) => {
  const input = {
    UserPoolId: process.env.USERPOOLID,
    Username: email,
  };

  try {
    const command = new AdminGetUserCommand(input);
    const response = await cognito.send(command);

    return response.$metadata.httpStatusCode;
  } catch (error) {
    throw new Error(error.message || "Failed to check user");
  }
}; //END isUserRegistered

export const addUserToGroup = async (username: string) => {
  const input = {
    UserPoolId: process.env.USERPOOLID,
    Username: username,
    GroupName: process.env.GROUPNAME,
  };

  try {
    const command = new AdminAddUserToGroupCommand(input);
    const response = await cognito.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to add user to group");
  }
}; //END addUserToGroup

export const updateUserAttributes = async (
  access_token: string,
  new_attributes: any
) => {
  const input = {
    AccessToken: access_token,
    UserAttributes: [
      {
        Name: "given_name",
        Value: new_attributes.given_name,
      },
      {
        Name: "family_name",
        Value: new_attributes.family_name,
      },
      {
        Name: "address",
        Value: new_attributes.address,
      },
      {
        Name: "birthdate",
        Value: new_attributes.birthdate,
      },
      {
        Name: "gender",
        Value: new_attributes.gender,
      },
      {
        Name: "custom:local_price",
        Value: new_attributes.price,
      },
      {
        Name: "custom:paypal_email",
        Value: new_attributes.paypal_email,
      },
      {
        Name: "custom:specialties",
        Value: new_attributes.specialties.join("-----"),
      },
    ],
  };

  try {
    const command = new UpdateUserAttributesCommand(input);
    const response = await cognito.send(command);

    return response;
  } catch (error) {
    console.error("UPDATE ATTRIBUTES ERROR: ", error);
    throw new Error(error.message || "Failed to upadte attributes");
  }
}; //END updateUserAttributes

export const getUserAttributes = async (access_token: string) => {
  const input = {
    AccessToken: access_token,
  };

  try {
    const command = new GetUserCommand(input);
    const response = await cognito.send(command);

    return response;
  } catch (error) {
    throw new Error(error.message || "Failed to get user attributes");
  }
}; //END getUserAttributes

export const checkUser = async (username: string, password: string) => {
  const input = {
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: process.env.CLIENTID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };
  try {
    const command = new InitiateAuthCommand(input);
    const data = await cognito.send(command);

    const access_token = data.AuthenticationResult?.AccessToken;

    return { access_token };
  } catch (error) {
    throw new Error(error.message || "Failed to sign in.");
  }
}; //END checkUser

//---------------------------------------------------------------------------------

export const confirmAccount = async (
  username: string,
  confirmation_code: string
) => {
  const input = {
    ClientId: process.env.CLIENTID,
    ConfirmationCode: confirmation_code,
    Username: username,
  };

  try {
    const command = new ConfirmSignUpCommand(input);
    await cognito.send(command);

    const isSpecialist = (await getUserType(username)).Value;

    if (isSpecialist === "true") addUserToGroup(username);
  } catch (error) {
    throw new Error(error.message || "Failed to confirm account.");
  }
}; //END confirmAccount

//---------------------------------------------------------------------------------

export const sendCode = async (username: string) => {
  const input = {
    ClientId: process.env.CLIENTID,
    Username: username,
  };

  try {
    const command = new ResendConfirmationCodeCommand(input);
    await cognito.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to send code.");
  }
}; //END sendCode

//---------------------------------------------------------------------------------

export const signUp = async (
  password: string,
  email: string,
  first_name: string,
  last_name: string,
  country: string,
  birthdate: string,
  gender: string,
  is_specialist: string,
  specialties: string[],
  local_price: string,
  international_price: string,
  profile_pic: string,
  paypal_email: string
) => {
  const input = {
    ClientId: process.env.CLIENTID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "given_name", Value: first_name },
      { Name: "family_name", Value: last_name },
      { Name: "address", Value: country },
      { Name: "birthdate", Value: birthdate },
      { Name: "gender", Value: gender },
      { Name: "custom:is_specialist", Value: is_specialist },
      { Name: "custom:specialties", Value: specialties.join("-----") },
      { Name: "custom:local_price", Value: local_price },
      { Name: "custom:international_price", Value: international_price },
      { Name: "custom:profile_pic", Value: profile_pic },
      { Name: "custom:paypal_email", Value: paypal_email },
    ],
  };

  try {
    const command = new SignUpCommand(input);
    const response = await cognito.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to sign in.");
  }
}; //END signUp

//---------------------------------------------------------------------------------

export const deleteAccount = async (username: string, password: string) => {
  const input = {
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: process.env.CLIENTID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(input);
    const data = await cognito.send(command);

    const token = data.AuthenticationResult?.AccessToken;
    if (token) {
      //await this.s3_service.delete('users-credentials', username);

      var params = {
        AccessToken: token,
      };

      const command2 = new DeleteUserCommand(params);
      await cognito.send(command2);
    }
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete account.");
  }
}; //END deleteAccount

//---------------------------------------------------------------------------------

export const getFcmToken = async (specialist_user_id: string) => {
  const params = {
    TableName: process.env.FCMTOKENTABLENAME,
    Key: {
      "user_id": {
        S: specialist_user_id,
      },
    },
    ProjectionExpression: "fcm_token",
  };

  try {
    const command = new GetItemCommand(params);
    const result = await ddbClient.send(command);
    const fcm_token = result.Item?.["fcm_token"]?.S;

    return { fcm_token };
  } catch (error: any) {
    throw new Error(error.message || "Failed to get FCM token.");
  }
}; //END getFcmToken

//---------------------------------------------------------------------------------

export const uploadFcmToken = async (user_id: string, fcm_token: string) => {
  const input = {
    "TableName": process.env.FCMTOKENTABLENAME,
    "Item": {
      "user_id": {
        "S": user_id,
      },
      "fcm_token": {
        "S": fcm_token,
      },
    },
  };

  try {
    const command = new PutItemCommand(input);
    await ddbClient.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to upload FCM token.");
  }
}; //END uploadFcmToken

//---------------------------------------------------------------------------------

export const deleteFcmToken = async (user_id: string) => {
  const input = {
    "TableName": process.env.FCMTOKENTABLENAME,
    "Key": {
      "user_id": { S: user_id },
    },
  };

  try {
    const command = new DeleteItemCommand(input);
    const response = await ddbClient.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to delete FCM token.");
  }
}; //END deleteFcmToken

//---------------------------------------------------------------------------------

export const signOut = async (access_token: string) => {
  const input = {
    AccessToken: access_token,
  };

  try {
    const command = new GlobalSignOutCommand(input);
    await cognito.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to sign out.");
  }
}; //END signOut

//---------------------------------------------------------------------------------

export const changePassword = async (
  username: string,
  previous_password: string,
  new_password: string
) => {
  const input = {
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: process.env.CLIENTID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: previous_password,
    },
  };

  try {
    const command = new InitiateAuthCommand(input);
    const data = await cognito.send(command);

    const token = data.AuthenticationResult?.AccessToken;
    if (token) {
      var params = {
        AccessToken: token,
        PreviousPassword: previous_password,
        ProposedPassword: new_password,
      };

      const command2 = new ChangePasswordCommand(params);
      await cognito.send(command2);
    }
  } catch (error) {
    throw new Error(error.message || "Failed to change password.");
  }
}; //END changePassword

//---------------------------------------------------------------------------------

export const changeForgottenPassword = async (
  confirmation_code: string,
  username: string,
  password: string
) => {
  const params = {
    ClientId: process.env.CLIENTID,
    ConfirmationCode: confirmation_code,
    Username: username,
    Password: password,
  };

  try {
    const command = new ConfirmForgotPasswordCommand(params);
    await cognito.send(command);
  } catch (error) {
    throw new Error(error.message || "Failed to change password.");
  }
}; //END changeForgottenPassword

//---------------------------------------------------------------------------------

export const forgotPassword = async (username: string) => {
  const params = {
    ClientId: process.env.CLIENTID,
    Username: username,
  };

  try {
    const command = new ForgotPasswordCommand(params);
    await cognito.send(command);
  } catch (error) {
    throw new Error(
      error.message || "Failed to send change password request code."
    );
  }
}; //END forgotPassword

//---------------------------------------------------------------------------------

export const refreshTokens = async (refresh_token: string) => {
  const params = {
    AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
    ClientId: process.env.CLIENTID,
    AuthParameters: {
      REFRESH_TOKEN: refresh_token,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const data = await cognito.send(command);

    const token_id = data.AuthenticationResult?.IdToken!;
    const access_token = data.AuthenticationResult?.AccessToken!;

    return { token_id, access_token };
  } catch (error) {
    throw new Error(error.message || "Failed to refresh tokens.");
  }
}; //END refreshTokens

//---------------------------------------------------------------------------------

export const signIn = async (email: string, password: string) => {
  const params = {
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: process.env.CLIENTID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const data = await cognito.send(command);

    const token_id = data.AuthenticationResult?.IdToken!;
    const access_token = data.AuthenticationResult?.AccessToken!;
    const refresh_token = data.AuthenticationResult?.RefreshToken!;
    const idTokenPayload = JSON.parse(
      Buffer.from(token_id.split(".")[1], "base64").toString("utf-8")
    );
    const user_id = idTokenPayload.sub;
    const first_name = idTokenPayload.given_name;

    const userGroups = idTokenPayload["cognito:groups"] || [];
    const user_role = userGroups.includes("specialist") ? "specialist" : "vet";

    return {
      token_id,
      access_token,
      refresh_token,
      user_id,
      email,
      first_name,
      user_role,
    };
  } catch (error) {
    if (error instanceof CognitoIdentityProviderServiceException) {
      throw {
        code: error.name,
        message: error.message,
      };
    }

    // ✅ Fallback error
    throw {
      code: "UnknownError",
      message: error.message || "Failed to sign in.",
    };
  }
}; //END signIn

export const getSpecialists = async (): Promise<Specialist[]> => {
  const input = {
    UserPoolId: process.env.USERPOOLID!,
    GroupName: process.env.GROUPNAME!,
  };

  try {
    const command = new ListUsersInGroupCommand(input);
    const response = await cognito.send(command);

    if (!response.Users) {
      throw new Error("No users found in the specified group.");
    }

    const users: Specialist[] = response.Users.map((user) => {
      if (!user.Attributes) {
        throw new Error(`User ${user.Username} has no attributes.`);
      }

      // Ensure both Name and Value are defined before adding to the accumulator
      return {
        Attributes: user.Attributes.reduce((acc, attr) => {
          if (attr.Name && attr.Value) {
            acc[attr.Name] = attr.Value;
          }
          return acc;
        }, {} as UserAttributes),
      };
    });

    return users;
  } catch (error) {
    console.error("Error getting specialists:", error);
    throw new Error("Failed to retrieve specialists");
  }
};
