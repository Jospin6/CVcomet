import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "../ui/InputField";
import { TextAreaField } from "../ui/textAreaField";
import { Button } from "../ui/button";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateUser, User } from "@/redux/user/userSlice";
import { useEffect } from "react";
import { transformStringToArray } from "@/lib/utils";
import { UserProfilItem } from "../ui/userProfilItem";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  skills: z.string().optional(),
  languages: z.string().optional(),
  github: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function EditUserForm({ user }: { user?: User }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      phone: "",
      address: "",
      linkedin: "",
      portfolio: "",
      skills: "",
      languages: "",
      github: "",
    }
  });
  const dispatch = useDispatch<AppDispatch>()
  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        name: user.name,
        phone: user.phone,
        address: user.address,
        linkedin: user.linkedin,
        portfolio: user.portfolio,
        skills: user.skills,
        languages: user.languages,
        github: user.github,
      });
    }
  }, [user, reset]);

  const onSubmit = (data: UserFormValues) => {
    dispatch(updateUser({ id: user?.id ?? "", data }))
    reset()
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border shadow border-gray-300 p-4 rounded-xl w-full">
      <UserProfilItem 
      subTitle="Your email address allows employers to contact you easily. Make sure it’s professional and up-to-date"
      title={"✉️ Email"} >
        <InputField
          label=""
          className="text-gray-800"
          name="email"
          placeholder="example@email.com"
          type="email"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Your full name is important for employers to know who you are. Make sure it’s professional and up-to-date"
      title={"👤 Name"} >
        <InputField
          label=""
          name="name"
          className="text-gray-800"
          placeholder="Your full name"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Providing your phone number ensures recruiters can quickly reach you for interviews or job offers"
      title={"📞 Phone"} >
        <InputField
          label=""
          name="phone"
          placeholder="+243..."
          className="text-gray-800"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Your address helps indicate your location for job opportunities and relocation considerations."
      title={"🏠 Address"} >
        <InputField
          label=""
          name="address"
          className="text-gray-800"
          placeholder="City, Country"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Specifying your preferred language ensures your CV and cover letter are tailored to the correct audience."
      title={"🌐 Languages"} >
        <div className="flex flex-wrap gap-2 mb-2">
          {transformStringToArray(user?.languages ?? "").map((language, index) => (
            <div key={index} className="px-5 py-[3px] text-sm rounded-2xl border">{language}</div>
          ))}
        </div>
        <InputField
          label=""
          name="languages"
          className="text-gray-800"
          placeholder="Ex: English, French"
          register={register}
          errors={errors}
        />
      </UserProfilItem>


      <UserProfilItem 
      subTitle="Including your LinkedIn profile adds credibility and gives recruiters a deeper insight into your professional background."
      title={"🔗 LinkedIn"} >
        <InputField
          label=""
          name="linkedin"
          className="text-gray-800"
          placeholder="https://linkedin.com/in/..."
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Sharing your GitHub allows employers to view your coding projects and contributions, showcasing your technical skills."
      title={"🐙 Github"} >
        <InputField
          label=""
          name="github"
          className="text-gray-800"
          placeholder="jospin6"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="A portfolio link provides quick access to your work samples, which can strengthen your application."
      title={"🖼️ Portfolio"} >
        <InputField
          label=""
          name="portfolio"
          className="text-gray-800"
          placeholder="https://yourportfolio.com"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle="Listing your key skills is crucial to highlight your strengths and match you with relevant job opportunities."
      title={"🛠️ Skills"} >
        <div className="flex flex-wrap gap-2 mb-2">
          {transformStringToArray(user?.skills ?? "").map((skill, index) => (
            <div key={index} className="px-5 py-[3px] text-sm rounded-2xl border">{skill}</div>
          ))}
        </div>
        <TextAreaField
          label=""
          name="skills"
          className="text-gray-800"
          placeholder="List your technical and soft skills"
          register={register}
          errors={errors}
        />
      </UserProfilItem>


      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? "Saving..." : "Save Profile"}</Button>
      </div>
    </form>
  );
}
