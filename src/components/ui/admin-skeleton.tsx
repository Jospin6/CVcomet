import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";


export const AdminSkeleton = () => {
    return <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
        <Skeleton className="h-8 w-64 mb-8 bg-gray-700" />

        <div className="mb-6 flex justify-end">
            <Button variant="outline" disabled className="bg-gray-800 text-gray-100 border-gray-600 opacity-50">
                <Skeleton className="h-4 w-24 bg-gray-600" />
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-32 bg-gray-600" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-16 bg-gray-600" />
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="mt-10">
            <Card className="bg-gray-800 border-gray-700 shadow-lg">
                <CardHeader>
                    <Skeleton className="h-6 w-32 bg-gray-600" />
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    {[...Array(4)].map((_, i) => (
                                        <th key={i} className="p-3">
                                            <Skeleton className="h-4 w-20 bg-gray-600" />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[...Array(5)].map((_, rowIndex) => (
                                    <tr key={rowIndex} className="border-t border-gray-700">
                                        {[...Array(4)].map((_, cellIndex) => (
                                            <td key={cellIndex} className="p-3">
                                                <Skeleton className="h-4 w-full bg-gray-600" />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
}