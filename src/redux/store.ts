// redux/store.ts
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./user/userSlice";
import experienceReducer from "./experience/experienceSlice";
import educationReducer from "./education/educationSlice";
import certificationReducer from "./certification/certificationSlice";
import projectReducer from "./project/projectSlice";
import cvReducer from "./cv/cvSlice";
import coverLetterReducer from "./coverLetter/coverLetterSlice";
import conversationReducer from "./conversation/conversationSlice";
import authReducer from "./auth/authSlice";
import templateReducer from "./template/templateSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
      experience: experienceReducer,
      education: educationReducer,
      certification: certificationReducer,
      project: projectReducer,
      cv: cvReducer,
      coverLetter: coverLetterReducer,
      conversation: conversationReducer,
      template: templateReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type RootState = ReturnType<AppStore["getState"]>;
