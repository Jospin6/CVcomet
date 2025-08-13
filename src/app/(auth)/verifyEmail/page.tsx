"use client";

import { VerifyEmailForm } from "@/components/forms/verifyEmailForm";


export default function VerifyEmaik() {

  return (<>
    <div className="md:w-[400px] w-[90%] bg-[#1a1a1a] shadow-amber-600 shadow-2xs mx-auto p-6">
      <VerifyEmailForm email={""}/>
    </div>
  </>);
}
