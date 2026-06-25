import axios from 'axios';
import FormData from 'form-data';

export class InvoiceService {

async createInvoice(
    booking: any
) {

    const today =
        new Date()
            .toISOString()
            .split('T')[0];

    const price =
        booking.services.price;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>

    <xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla">

    <beallitasok> <szamlaagentkulcs>${process.env.SZAMLAZZ_AGENT_KEY?.trim()}</szamlaagentkulcs>

    <eszamla>true</eszamla>

    <szamlaLetoltes>true</szamlaLetoltes>

    <valaszVerzio>2</valaszVerzio>

    </beallitasok>

    <fejlec>

        <teljesitesDatum>
            ${today}
        </teljesitesDatum>

        <fizetesiHataridoDatum>
            ${today}
        </fizetesiHataridoDatum>

        <fizmod>
            Bankkártya
        </fizmod>

        <fizetve>
            true
        </fizetve>

        <penznem>
            HUF
        </penznem>

        <szamlaNyelve>
            hu
        </szamlaNyelve>

    </fejlec>

    <elado>

        <bank>${process.env.SELLER_BANK}</bank>

        <bankszamlaszam>
            ${process.env.SELLER_BANK_ACCOUNT}
        </bankszamlaszam>

        <emailReplyto>
            ${process.env.SELLER_EMAIL}
        </emailReplyto>

        <emailTargy>
            CE Massage számla
        </emailTargy>

        <emailSzoveg>
            Köszönjük foglalását!
        </emailSzoveg>

    </elado>

    <vevo>

    <nev>
        ${booking.billing_name}
    </nev>

    <irsz>
        ${booking.billing_zip}
    </irsz>

    <telepules>
        ${booking.billing_city}
    </telepules>

    <cim>
        ${booking.billing_address}
    </cim>

    <email>
        ${booking.customer_email}
    </email>

    <sendEmail>
        true
    </sendEmail>

    </vevo>

    <tetelek>

    <tetel>

        <megnevezes>${booking.services.name}</megnevezes>

        <mennyiseg>1</mennyiseg>

        <mennyisegiEgyseg>db</mennyisegiEgyseg>

        <nettoEgysegar>${price}</nettoEgysegar>

        <afakulcs>AAM</afakulcs>

        <nettoErtek>${price}</nettoErtek>

        <afaErtek>0</afaErtek>

        <bruttoErtek>${price}</bruttoErtek>

    </tetel>

    </tetelek>

    </xmlszamla>`;

    const form =
        new FormData();

    form.append(
        'action-xmlagentxmlfile',
        xml,
        {
            filename:
                'invoice.xml'
        }
    );

    const response =
        await axios.post(
            'https://www.szamlazz.hu/szamla/',
            form,
            {
                headers:
                    form.getHeaders()
            }
        );

    const invoiceNumberMatch =
        response.data.match(
            /<szamlaszam>(.*?)<\/szamlaszam>/
        );

    const invoiceNumber =
        invoiceNumberMatch?.[1];

        return {
            invoiceNumber,
            rawResponse: response.data
        };
    }
}