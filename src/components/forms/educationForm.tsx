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

const educationSchema = z.object({
  degree: z.string().min(1, "Degree is required"),
  school: z.string().min(1, "School is required"),
  location: z.string().min(1, "Location is required"),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional()
});

type EducationFormValues = z.infer<typeof educationSchema>;

export default function EducationForm({ user }: { user: User }) {
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
    try {
      if (!user.id) {
        console.log("User ID is missing");
        return;
      }
      await dispatch(addEducation({ userId: user.id, ...data }));
      setSuccessMessage("Education added successfully!");
      reset();
    } catch (err) {
      console.log(err);
      setSuccessMessage(null);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-700 p-4 rounded-xl space-y-4">
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      )}
      <div className="grid grid-cols-8 gap-4">
        <InputField
          label="Start Date"
          className="col-span-2"
          name="start"
          placeholder="YYYY-MM-DD"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label="End Date"
          className="col-span-2"
          name="end"
          placeholder="YYYY-MM-DD (optional)"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label="Degree"
          className="col-span-2"
          name="degree"
          placeholder="ex: Bachelor of Science in Computer Science"
          register={register}
          errors={errors}
        />
        <InputField
          label="School"
          className="col-span-2"
          name="school"
          placeholder="ex: Harvard University"
          register={register}
          errors={errors}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? "Saving..." : "Add Education"}</Button>
      </div>
    </form>
  );
}
