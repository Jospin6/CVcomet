
export const UserProfilItem = ({ title, subTitle, children }: { title: string, subTitle?: string, children: React.ReactNode }) => {
    return <div className="grid grid-cols-4 border-b border-gray-300 gap-4 py-3 mb-4">
        <div className="col-span-2">
            <div className="text-[17px] text-gray-900 font-bold">{title}</div>
            <div className="text-[12px] text-gray-800">{subTitle}</div>
        </div>
        <div className="col-span-2">
            {children}
        </div>
    </div>
}