#!/usr/bin/env python3
"""
Generator of Shoptet XML Product Items (<SHOPITEM>) for vsebezlepku.cz
"""

import argparse
import sys
import uuid
from xml.sax.saxutils import escape

def format_allergens(text: str) -> str:
    """Convert **allergen** markdown syntax into <strong>allergen</strong> HTML."""
    import re
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)

def generate_shopitem_xml(data: dict) -> str:
    guid = data.get("guid") or str(uuid.uuid4())
    code = data.get("code", "")
    name = data.get("name", "")
    short_desc = data.get("short_desc", "")
    long_desc = data.get("long_desc", "")
    ingredients = format_allergens(data.get("ingredients", ""))
    manufacturer = data.get("manufacturer", "Piaceri Mediterranei")
    supplier = data.get("supplier", manufacturer)
    price = data.get("price", "0")
    purchase_price = data.get("purchase_price", "0")
    weight = data.get("weight", "0.25")
    package_amount = data.get("package_amount", "250")
    package_unit = data.get("package_unit", "g")
    category_id = data.get("category_id", "940")
    category_name = data.get("category_name", "Těstoviny > Tortelloni a Tortellini")
    image_url = data.get("image_url", "")
    
    # Nutrition
    energy = data.get("energy", "933 kJ / 222 kcal")
    fat = data.get("fat", "6,7 g")
    sat_fat = data.get("sat_fat", "3,7 g")
    carbs = data.get("carbs", "32,5 g")
    sugars = data.get("sugars", "6,3 g")
    fiber = data.get("fiber", "4,2 g")
    protein = data.get("protein", "5,7 g")
    salt = data.get("salt", "1,26 g")

    nutrition_table = f"""<table style="width: 364px;">
<thead>
<tr>
<th style="width: 245px;"><p><b>Energetická hodnota</b></p></th>
<th style="width: 119px;"><p><b>{energy}</b></p></th>
</tr>
</thead>
<tbody>
<tr><td><p><span>Tuky</span></p></td><td><p><span>{fat}</span></p></td></tr>
<tr><td><p><span>z toho nasycené mastné kyseliny</span></p></td><td><p><span>{sat_fat}</span></p></td></tr>
<tr><td><p><span>Sacharidy</span></p></td><td><p><span>{carbs}</span></p></td></tr>
<tr><td><p><span>z toho cukry</span></p></td><td><p><span>{sugars}</span></p></td></tr>
<tr><td><p><span>Vláknina</span></p></td><td><p><span>{fiber}</span></p></td></tr>
<tr><td><p><span>Bílkoviny</span></p></td><td><p><span>{protein}</span></p></td></tr>
<tr><td><p><span>Sůl</span></p></td><td><p><span>{salt}</span></p></td></tr>
</tbody>
</table>"""

    full_description = f"""<![CDATA[
<p>{long_desc if long_desc else short_desc}</p>
<p>&nbsp;</p>
<p><strong>Složení:&nbsp;</strong></p>
<p>{ingredients}</p>
<p>&nbsp;</p>
<p><strong>Nutriční hodnoty (na 100g):</strong></p>
{nutrition_table}
<p>&nbsp;</p>
]]>"""

    return f"""<SHOPITEM id="{code}">
    <NAME>{escape(name)}</NAME>
    <GUID>{guid}</GUID>
    <CODE>{code}</CODE>
    <SHORT_DESCRIPTION><![CDATA[<p>{short_desc}</p>]]></SHORT_DESCRIPTION>
    <DESCRIPTION>{full_description}</DESCRIPTION>
    <MANUFACTURER>{escape(manufacturer)}</MANUFACTURER>
    <SUPPLIER>{escape(supplier)}</SUPPLIER>
    <ADULT>0</ADULT>
    <ITEM_TYPE>product</ITEM_TYPE>
    <CATEGORIES>
        <CATEGORY id="{category_id}">{escape(category_name)}</CATEGORY>
        <DEFAULT_CATEGORY id="{category_id}">{escape(category_name)}</DEFAULT_CATEGORY>
    </CATEGORIES>
    <IMAGES>
        <IMAGE description="{escape(name)}">{image_url}</IMAGE>
    </IMAGES>
    <FLAGS>
        <FLAG><CODE>action</CODE><ACTIVE>0</ACTIVE></FLAG>
        <FLAG><CODE>new</CODE><ACTIVE>1</ACTIVE></FLAG>
        <FLAG><CODE>tip</CODE><ACTIVE>0</ACTIVE></FLAG>
    </FLAGS>
    <VISIBILITY>visible</VISIBILITY>
    <ALLOWS_PAY_ONLINE>1</ALLOWS_PAY_ONLINE>
    <UNIT>ks</UNIT>
    <LOGISTIC>
        <WEIGHT>{weight}</WEIGHT>
    </LOGISTIC>
    <UNIT_OF_MEASURE>
        <PACKAGE_AMOUNT>{package_amount}</PACKAGE_AMOUNT>
        <PACKAGE_AMOUNT_UNIT>{package_unit}</PACKAGE_AMOUNT_UNIT>
        <MEASURE_AMOUNT>100</MEASURE_AMOUNT>
        <MEASURE_AMOUNT_UNIT>{package_unit}</MEASURE_AMOUNT_UNIT>
    </UNIT_OF_MEASURE>
    <CURRENCY>CZK</CURRENCY>
    <VAT>12</VAT>
    <STANDARD_PRICE>{price}</STANDARD_PRICE>
    <PRICE_VAT>{price}</PRICE_VAT>
    <PURCHASE_PRICE>{purchase_price}</PURCHASE_PRICE>
    <STOCK>
        <AMOUNT>0</AMOUNT>
    </STOCK>
    <AVAILABILITY_OUT_OF_STOCK>Na dotaz</AVAILABILITY_OUT_OF_STOCK>
    <AVAILABILITY_IN_STOCK>Skladem</AVAILABILITY_IN_STOCK>
    <VISIBLE>1</VISIBLE>
</SHOPITEM>"""

def main():
    parser = argparse.ArgumentParser(description="Generate Shoptet XML SHOPITEM for vsebezlepku.cz")
    parser.add_argument("--code", required=True, help="Product code (ID)")
    parser.add_argument("--name", required=True, help="Product Name")
    parser.add_argument("--price", required=True, help="Selling price with VAT in CZK")
    parser.add_argument("--purchase-price", default="0", help="Purchase price without VAT in CZK")
    parser.add_argument("--manufacturer", default="Piaceri Mediterranei", help="Brand name")
    parser.add_argument("--weight", default="0.25", help="Weight in kg (e.g. 0.25)")
    parser.add_argument("--package-amount", default="250", help="Package amount (e.g. 250)")
    parser.add_argument("--category-id", default="940", help="Category ID")
    parser.add_argument("--category-name", default="Těstoviny > Tortelloni a Tortellini", help="Category Name")
    parser.add_argument("--short-desc", default="", help="Short description")
    parser.add_argument("--ingredients", default="", help="Ingredients with **allergens** bolded")
    parser.add_argument("--image-url", default="", help="Image URL")
    parser.add_argument("--energy", default="933 kJ / 222 kcal")
    parser.add_argument("--fat", default="6,7 g")
    parser.add_argument("--sat-fat", default="3,7 g")
    parser.add_argument("--carbs", default="32,5 g")
    parser.add_argument("--sugars", default="6,3 g")
    parser.add_argument("--fiber", default="4,2 g")
    parser.add_argument("--protein", default="5,7 g")
    parser.add_argument("--salt", default="1,26 g")

    args = parser.parse_args()
    xml_output = generate_shopitem_xml(vars(args))
    print(xml_output)

if __name__ == "__main__":
    main()
