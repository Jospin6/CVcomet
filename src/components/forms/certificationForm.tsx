import { useForm } from "react-hook-form";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { TextAreaField } from "../ui/textAreaField";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from 'react-i18next';
import { User } from "@/redux/user/userSlice";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addCertification } from "@/redux/certification/certificationSlice";
import { useState } from "react";

// Définir le schéma de validation
const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  organization: z.string().min(1, "Organization is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional()
});

type CertificationFormValues = z.infer<typeof certificationSchema>;

export default function CertificationForm({ user }: { user?: User }) {
  const { t } = useTranslation();
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationSchema),
  });
  const dispatch = useDispatch<AppDispatch>()
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = async (data: CertificationFormValues) => {
    try {
      if (!user?.id) {
        console.log("User ID is missing");
        return;
      }
      await dispatch(addCertification({ userId: user.id, ...data }));
      setSuccessMessage("Education added successfully!");
      reset();
    } catch (err) {
      console.log(err);
      setSuccessMessage(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-500 p-3 rounded-2xl">
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      )}
     <div className="md:grid md:grid-cols-6 gap-4">
       <InputField
        label={`${t("certificatName")}`}
        className="col-span-2"
        name="name"
        placeholder="Enter certification name"
        register={register}
        errors={errors}
      />

      <InputField
        label="Organization"
        className="col-span-2"
        name="organization"
        placeholder="Enter organization name"
        register={register}
        errors={errors}
      />

      <InputField
        label="Date"
        className="col-span-2"
        name="date"
        type="date"
        placeholder="Enter certification date"
        register={register}
        errors={errors}
      />
     </div>

      <div>
        <TextAreaField
          label={"Description"}
          name={"description"}
          placeholder={"What did you learn as education"}
          register={register}
          errors={errors} />
      </div>

      <div className="flex justify-end my-4">
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("addCertificat")}`}</Button>
      </div>
    </form>
  );
}
