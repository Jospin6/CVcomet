import { formatDateToFullYear } from '@/lib/utils';
import { useTranslation } from 'react-i18next'
import {Text } from '@react-pdf/renderer';

export const CurrentDate = () => {
    const { i18n } = useTranslation();

    const lang = i18n.language.split('-')[0];

    const date = formatDateToFullYear(Date.now(), lang)

    return <Text>
        {date}
    </Text>

}