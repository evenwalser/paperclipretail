// import type { NextApiRequest, NextApiResponse } from "next";
// import formidable from "formidable";
// import FormData from "form-data"; // Use 'form-data' for sending FormData to /login
// import fs from "fs";

// export const config = {
//   api: {
//     bodyParser: false, // We handle parsing manually
//   },
// };

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Method not allowed" });
//   }

//   const form = formidable({ multiples: true, keepExtensions: true });

//   form.parse(req, async (err, fields, files) => {
//     if (err) {
//       console.error("Form parse error:", err);
//       return res.status(500).json({ error: "Form parsing failed", details: err.message });
//     }

//     // Debugging logs to check parsed data
//     console.log("Fields:", fields);
//     console.log("Files:", files);

//     // Rebuild the FormData for the /login API
//     const formDataToSend = new FormData();

//     // Add regular fields
//     formDataToSend.append("name", Array.isArray(fields.name) ? fields.name[0] : fields.name || '');
//     formDataToSend.append("description", Array.isArray(fields.description) ? fields.description[0] : fields.description || '');
//     formDataToSend.append("categoryId", Array.isArray(fields.categoryId) ? fields.categoryId[0] : fields.categoryId || '');
//     formDataToSend.append("price", Array.isArray(fields.price) ? fields.price[0] : fields.price || '');
//     formDataToSend.append("conditionType", Array.isArray(fields.conditionType) ? fields.conditionType[0] : fields.conditionType || '');
//     formDataToSend.append("packageSize", Array.isArray(fields.packageSize) ? fields.packageSize[0] : fields.packageSize || '');
//     formDataToSend.append("retailId", Array.isArray(fields.retailId) ? fields.retailId[0] : fields.retailId || '');

//     // Handle tags array
//     if (fields.tags) {
//         const tags = Array.isArray(fields.tags) ? fields.tags : [fields.tags];
//         tags.forEach((tag, index) => {
//             formDataToSend.append(`tags[${index}]`, tag);
//         });
//     }

//     // Add files to FormData
//     if (files.media) {
//         const mediaFiles = Array.isArray(files.media) ? files.media : [files.media];
//         mediaFiles.forEach((file, index) => {
//             formDataToSend.append(`media[${index}]`, fs.createReadStream(file.filepath), {
//                 filename: file.originalFilename ?? undefined,
//                 contentType: file.mimetype ?? undefined,
//             });
//         });
//     }

//     try {
//       // Send FormData to /login endpoint
//       const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_PAPERCLIP_API_URL}/v4/items`, {
//         method: "POST",
//         headers: formDataToSend.getHeaders(),
//         body: formDataToSend as any,
//       });

//       if (!loginResponse.ok) {
//         const errorText = await loginResponse.text();
//         console.error("Login API error:", errorText);
//         return res.status(500).json({ error: "Login API failed", details: errorText });
//       }

//       const loginResult = await loginResponse.json();

//       // Respond back with success
//       return res.status(200).json({
//         success: true,
//         loginResult,
//       });
//     } catch (apiError: any) {
//       console.error("Error forwarding to /login:", apiError);
//       return res.status(500).json({ error: "Failed to call /login", details: apiError.message });
//     }
//   });
// }
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/utils/supabase/client";
import formidable from "formidable";
import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: { bodyParser: false },
};

function mapConditionToType(condition: string): number {
  switch (condition.toLowerCase()) {
    case "new":          return 0;
    case "refurbished":  return 1;
    case "used":         return 4;
    default:             return 0;
  }
}

const supabase = createClient();

async function getPaperclipToken(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from("user_tokens")
      .select("paperclip_token")
      .eq("user_id", userId)
      .single();
  
    if (error || !data) {
      console.error("Error fetching Paperclip token:", error);
      throw new Error("Unable to authenticate with Paperclip");
    }
  
    return data.paperclip_token;
  }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // create the formidable parser
  const form = formidable({ multiples: true, keepExtensions: true });

  try {
    // await the parse to complete
    const { fields, files } = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });
    console.log("🚀 ~ handler ~ fields:", fields)
    // normalize fields
    const userId      = (Array.isArray(fields.userId)    ? fields.userId[0]    : fields.userId)    || "";
    console.log("🚀 ~ handler ~ userId:", userId)
    const name        = (Array.isArray(fields.name)      ? fields.name[0]      : fields.name)      || "";
    console.log("🚀 ~ handler ~ name:", name)
    const description = (Array.isArray(fields.description) ? fields.description[0] : fields.description) || "";
    console.log("🚀 ~ handler ~ description:", description)
    const price       = (Array.isArray(fields.price)     ? fields.price[0]     : fields.price)     || "0";
    console.log("🚀 ~ handler ~ price:", price)
    const condition   = (Array.isArray(fields.condition) ? fields.condition[0] : fields.condition) || "new";
    console.log("🚀 ~ handler ~ condition:", condition)
    const retailId    = (Array.isArray(fields.retailId)  ? fields.retailId[0]  : fields.retailId)  || "";
    console.log("🚀 ~ handler ~ retailId:", retailId)
    const tagsField   = fields.tags;
    console.log("🚀 ~ handler ~ tagsField:", tagsField)
    const tags        = tagsField
    ? (Array.isArray(tagsField) ? tagsField : [tagsField]).map(t => t.toString())
    : [];
    console.log("🚀 ~ handler ~ tags:", tags)

    // get token
    const supabase = createClient();
    const paperclipToken = await getPaperclipToken(userId);

    // build FormData for Paperclip
    const formDataToSend = new FormData();
    formDataToSend.append("name",        name.trim());
    formDataToSend.append("description", description.trim());
    formDataToSend.append("price",       parseFloat(price).toString());
    formDataToSend.append("conditionType", mapConditionToType(condition).toString());
    formDataToSend.append("packageSize",  "Medium");
    formDataToSend.append("retailId",     retailId);
    formDataToSend.append("categoryId",     "1");
    tags.forEach((t, i) => formDataToSend.append(`tags[${i}]`, t));

    if (files.media) {
      const mediaArr = Array.isArray(files.media) ? files.media : [files.media];
      mediaArr.forEach((file, idx) => {
        formDataToSend.append(
          `media[${idx}]`,
          fs.createReadStream(file.filepath),
          {
            filename:    file.originalFilename || `media-${idx}`,
            contentType: file.mimetype || undefined,
          }
        );
      });
    }

    // call Paperclip
    const apiRes = await fetch(
      `${process.env.NEXT_PUBLIC_PAPERCLIP_API_URL}/v4/items`,
      {
        method:  "POST",
        headers: {
          Authorization: `Bearer ${paperclipToken}`,
        },
        body:    formDataToSend as any,
      }
    );
    console.log("🚀 ~ handler ~ apiRes:", apiRes)
    if (!apiRes.ok) {
      const txt = await apiRes.text();
      console.error("Paperclip API error:", txt);
      return res.status(apiRes.status).json({ error: txt });
    }
    const result = await apiRes.json() as { data?: { id?: string } };
    console.log("🚀 ~ handler ~ result:", result)

    // optional: update your Supabase table
    if (retailId) {
      const { error: updErr } = await supabase
        .from("items")
        .update({
          paperclip_marketplace_id: result?.data?.id,
          paperclip_listed_at:      new Date().toISOString(),
          listed_on_paperclip:      true,
        })
        .eq("id", retailId);

      if (updErr) console.error("Supabase update error:", updErr);
    }

    // finally—send the response
    return res.status(200).json(result);

  } catch (err: any) {
    console.error("Error in /create-items:", err);
    // if it's a parsing error, it'll come through here
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
