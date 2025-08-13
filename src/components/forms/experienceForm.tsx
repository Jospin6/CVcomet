import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "../ui/InputField";
import { TextAreaField } from "../ui/textAreaField";
import { Button } from "../ui/button";
import { User } from "@/redux/user/userSlice";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addExperience, updateExperience } from "@/redux/experience/experienceSlice";
import { useTranslation } from 'react-i18next';
import { toast } from "sonner";

const experienceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().min(1, "Location is required"),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  description: z.string().optional()
});

type ExperienceFormValues = z.infer<typeof experienceSchema>;

export default function ExperienceForm({ user, initialData, id, onSuccess }: { id?: string, onSuccess?: () => void, user?: User, initialData?: ExperienceFormValues }) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>()
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      title: "",
      company: "",
      location: "",
      start: "",
      end: "",
      description: "",
    }
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        company: initialData.company,
        location: initialData.location,
        start: initialData.start,
        end: initialData.end,
        description: initialData.description,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ExperienceFormValues) => {
    if (!user?.id) {
      toast.error("User ID is missing");
      return;
    }

    try {
      let result
      if (!initialData) {
        result = await dispatch(addExperience({ userId: user.id, ...data }));
      } else {
        if (id) {
          result = await dispatch(updateExperience({
          id,
          userId: user.id,
          ...data
        }));
        }
      }
      

      if (addExperience.fulfilled.match(result) || updateExperience.fulfilled.match(result)) {
        toast.success("Experience added or updated successfully!");
        if (onSuccess) {
          onSuccess()
        }
        reset();
      } else {
        toast.error("Failed to add experience. Please try again.");
      }
    } catch (err) {
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
      <div className="md:grid md:grid-cols-10 gap-4">
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
          label={`${t("jobTile")}`}
          className="col-span-2"
          name="title"
          placeholder="ex: Software Engineer"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("company")}`}
          className="col-span-2"
          name="company"
          placeholder="ex: Google"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("location")}`}
          className="col-span-2"
          name="location"
          placeholder="ex: San Francisco, USA"
          register={register}
          errors={errors}
        />
      </div>
      <TextAreaField
        label="Description"
        name="description"
        placeholder="Brief description of your responsibilities and achievements"
        register={register}
        errors={errors}
      />
      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("addExperience")}`}</Button>
      </div>
    </form>
  );
}
