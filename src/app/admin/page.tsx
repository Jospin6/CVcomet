"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCoverLetter } from "@/redux/coverLetter/coverLetterSlice";
import { fetchCvs } from "@/redux/cv/cvSlice";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchUsers } from "@/redux/user/userSlice";
import { motion } from "framer-motion";
import { useEffect } from "react";
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
    const subscribedUsers = users.filter(user => user.isSubscribed).length; // Assuming you have a 'subscribed' field in your user model
    useEffect(()=> {
        dispatch(fetchUsers())
        dispatch(fetchCvs())
        dispatch(fetchCoverLetter())
    }, [dispatch])
  return (
    <div className="">
      <h1 className="text-2xl text-white font-bold mb-8">Admin Dashboard</h1>

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
