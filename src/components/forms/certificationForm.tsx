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
import { addCertification, updateCertification } from "@/redux/certification/certificationSlice";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Définir le schéma de validation
const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  organization: z.string().min(1, "Organization is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional()
});

type CertificationFormValues = z.infer<typeof certificationSchema>;

export default function CertificationForm({ user, initialData, id, onSuccess }: {id?: string, onSuccess?: () => void, user?: User, initialData?: CertificationFormValues }) {
  const { t } = useTranslation();
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationSchema),
    defaultValues: {
      name: "",
      organization: "",
      date: "",
      description: "",
    }
  });
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        organization: initialData.organization,
        date: initialData.date,
        description: initialData.description,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: CertificationFormValues) => {

    if (!user?.id) {
      toast.error("Échec de l'ajout de la certification.");
      return;
    }

    try {
      let resultAction;
      if (!initialData) {
        resultAction = await dispatch(addCertification({ userId: user.id, ...data }));
      } else {
        if (id) {
          resultAction = await dispatch(updateCertification({ userId: user.id, ...data, id }));
        }
      }

      if (addCertification.fulfilled.match(resultAction) || updateCertification.fulfilled.match(resultAction)) {
        if (onSuccess) {
          onSuccess()
        }
        reset();
        toast.success("Certification added successfully!");
      } else {
        toast.error("Certification Failed to add.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-500 p-3 rounded-2xl">
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
