import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { User } from "@/redux/user/userSlice";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addEducation } from "@/redux/education/educationSlice";
import { useTranslation } from 'react-i18next';
import { TextAreaField } from "../ui/textAreaField";
import { toast } from "sonner";

const educationSchema = z.object({
  degree: z.string().min(1, "Degree is required"),
  school: z.string().min(1, "School is required"),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  description: z.string().optional()
});

type EducationFormValues = z.infer<typeof educationSchema>;

export default function EducationForm({ user }: { user?: User }) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>()
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EducationFormValues>({
    resolver: zodResolver(educationSchema),
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const onSubmit = async (data: EducationFormValues) => {
    if (!user?.id) {
      toast.error("User ID is missing");
      return;
    }

    try {
      const result = await dispatch(addEducation({ userId: user.id, ...data }));

      if (addEducation.fulfilled.match(result)) {
        toast.success("Education added successfully!");
        reset();
        window.location.reload();
      } else {
        toast.error("Failed to add education.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border-[1px] border-gray-500 shadow p-4 rounded-xl space-y-4">
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      )}
      <div className="md:grid md:grid-cols-8 gap-4">
        <InputField
          label={`${t("start")}`}
          className="col-span-2"
          name="start"
          placeholder="YYYY-MM-DD"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("end")}`}
          className="col-span-2"
          name="end"
          placeholder="YYYY-MM-DD (optional)"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("degree")}`}
          className="col-span-2"
          name="degree"
          placeholder="ex: Bachelor of Science in Computer Science"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("school")}`}
          className="col-span-2"
          name="school"
          placeholder="ex: Harvard University"
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

      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("addEducation")}`}</Button>
      </div>
    </form>
  );
}
