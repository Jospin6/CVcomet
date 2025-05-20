
export const UserProfilItem = ({ title, subTitle, icon, children }: { icon?: React.ReactElement, title: string, subTitle?: string, children: React.ReactNode }) => {
    return <div className="md:grid md:grid-cols-4 border-b-[1px] border-gray-500 gap-4 py-3 mb-4">
        <div className="col-span-2">
            <div className="text-[17px] text-gray-200 font-bold flex items-center">
                {icon && <>{icon} &nbsp;</>}
                {title}
            </div>
            <div className="text-[12px] text-gray-300">{subTitle}</div>
        </div>
        <div className="col-span-2">
            {children}
        </div>
    </div>
}