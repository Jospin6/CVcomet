import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "../ui/InputField";
import { TextAreaField } from "../ui/textAreaField";
import { Button } from "../ui/button";

const experienceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().min(1, "Location is required"),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  description: z.string().optional(),
});

type ExperienceFormValues = z.infer<typeof experienceSchema>;

export default function ExperienceForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    // defaultValues,
  });

  const onSubmit = () => {

  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-700 p-4 rounded-xl space-y-4">
      <div className="grid grid-cols-10 gap-4">
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
          label="Job Title"
          className="col-span-2"
          name="title"
          placeholder="ex: Software Engineer"
          register={register}
          errors={errors}
        />
        <InputField
          label="Company"
          className="col-span-2"
          name="company"
          placeholder="ex: Google"
          register={register}
          errors={errors}
        />
        <InputField
          label="Location"
          className="col-span-2"
          name="location"
          placeholder="ex: San Francisco, USA"
          register={register}
          errors={errors}
        />
      </div>
      {/* <TextAreaField
        label="Description"
        name="description"
        placeholder="Brief description of your responsibilities and achievements"
        register={register}
        errors={errors}
      /> */}
      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? "Saving..." : "Add Experience"}</Button>
      </div>
    </form>
  );
}
