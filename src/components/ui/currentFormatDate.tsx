import { formatDateToFullYear } from '@/lib/utils';
import { useTranslation } from 'react-i18next'

export const CurrentFormatDate = () => {
    const { i18n } = useTranslation();

    const lang = i18n.language.split('-')[0];

    const date = formatDateToFullYear(Date.now(), lang)

    return <span>
        {date}
    </span>

}