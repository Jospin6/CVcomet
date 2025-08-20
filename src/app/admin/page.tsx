"use client"
import AddTemplatePage from "@/components/forms/templeteForm";
import { AdminSkeleton } from "@/components/ui/admin-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogHeader, DialogTitle, Dialog, DialogTrigger, DialogContent, } from "@/components/ui/dialog";
import TemplateCardList from "@/components/ui/templateCardList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchCoverLetter } from "@/redux/coverLetter/coverLetterSlice";
import { fetchCvs } from "@/redux/cv/cvSlice";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchTemplates } from "@/redux/template/templateSlice";
import { fetchUser, fetchUsers, selectUser } from "@/redux/user/userSlice";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

type StatCardProps = {
  title: string;
  value: string;
};

const StatCard = ({ title, value }: StatCardProps) => (
  <div className="transform transition-transform hover:scale-105">
    <Card className="w-full shadow-xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{value}</p>
      </CardContent>
    </Card>
  </div>
);

export default function AdminDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const users = useSelector((state: RootState) => state.user.users);
  const cvs = useSelector((state: RootState) => state.cv.cvs);
  const letters = useSelector((state: RootState) => state.coverLetter.letters);
  const subscribedUsers = users.filter(user => user.isSubscribed).length;
  const templates = useSelector((state: RootState) => state.template.templates);
  const { user: currentUser, loading } = useCurrentUser()
  const user = useSelector(selectUser);

  useEffect(() => {
    if (currentUser?.id) {
      dispatch(fetchUser(currentUser?.id))
    }
  }, [currentUser?.id, dispatch])

  useEffect(() => {
    dispatch(fetchUsers())
    dispatch(fetchCvs())
    dispatch(fetchCoverLetter())
    dispatch(fetchTemplates())
  }, [dispatch])

  if (loading) {
    return <AdminSkeleton/>;
  }
  if(user?.role !== "ADMIN") return redirect("/unauthorized"); 
  return (
    <div className="">
      <h1 className="text-2xl text-white font-bold mb-8">Admin Dashboard</h1>

      <div className="mb-4 flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Add template</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add template</DialogTitle>
            </DialogHeader>
            <div>
              <AddTemplatePage />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={`${users.length}`} />
        <StatCard title="Generated CVs" value={`${cvs.length}`} />
        <StatCard title="Generated Cover Letters" value={`${letters.length}`} />
        <StatCard title="Subscribed Users" value={`${subscribedUsers}`} />
      </div>
      <div className="mt-10">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2 font-semibold">User name</th>
                    <th className="p-2 font-semibold">Email</th>
                    <th className="p-2 font-semibold">Is Subscribed</th>
                    <th className="p-2 font-semibold">Created at</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="p-2">{user.name}</td>
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">{user.isSubscribed ? "✅" : "❌"}</td>
                      <td className="p-2">{new Date(user.createdAt!).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
