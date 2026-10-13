// redux/store.ts
import { combineReducers, configureStore } from "@reduxjs/toolkit";
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

const appReducer = combineReducers({
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
});

const rootReducer: typeof appReducer = (state, action) => {
  const sessionChanged = ["auth/logout/fulfilled", "auth/login/fulfilled", "auth/signup/fulfilled"].includes(action.type);
  return appReducer(sessionChanged ? undefined : state, action);
};

export const makeStore = () => configureStore({ reducer: rootReducer });

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type RootState = ReturnType<AppStore["getState"]>;
