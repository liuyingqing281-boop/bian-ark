"""
为 docx 文件添加 OLE 嵌入附件（显示为图标）
使用 Word COM 自动化
"""
import sys
import os

def add_ole_attachments(docx_path: str, attachments: list[tuple[str, str]]):
    """
    docx_path: 要修改的 docx 文件路径
    attachments: [(文件路径, 显示名称), ...]
    """
    import win32com.client
    import pythoncom

    pythoncom.CoInitialize()
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0

        # 打开 docx
        doc = word.Documents.Open(os.path.abspath(docx_path))

        # 移动到文档末尾
        doc.Range().Collapse(0)  # 0 = wdCollapseEnd
        doc.Range().InsertBreak(2)  # 2 = wdPageBreak

        for file_path, display_name in attachments:
            if not os.path.exists(file_path):
                print(f"文件不存在: {file_path}")
                continue

            # 插入 OLE 对象，显示为图标
            # 2 = wdInlineShapeOLEControl
            shape = doc.InlineShapes.AddOLEControl(
                ClassName="",  # 空字符串表示从文件创建
                FileName=os.path.abspath(file_path),
                LinkToFile=False,  # 嵌入而非链接
                DisplayAsIcon=True,
                IconIndex=0,
                IconLabel=display_name,
                Range=doc.Range()
            )

            # 换行
            doc.Range().InsertAfter("\n")
            print(f"已添加: {display_name}")

        # 保存
        doc.Save()
        doc.Close()
        word.Quit()
        print("完成!")

    finally:
        pythoncom.CoUninitialize()


if __name__ == "__main__":
    docx_path = r"D:\1.个人资料\彼岸墓园算法开发上线资料\落实算法安全主体责任基本情况-终稿.docx"

    # 先导出隐私政策和用户协议为 PDF
    # 然后作为附件嵌入
    attachments = [
        (r"D:\1.个人资料\彼岸墓园算法开发上线资料\隐私政策.pdf", "附件一：隐私政策"),
        (r"D:\1.个人资料\彼岸墓园算法开发上线资料\用户协议.pdf", "附件二：用户协议"),
    ]

    # 先用 python-docx 添加文字内容（上一条命令已做）
    # 这里只添加 OLE 附件
    add_ole_attachments(docx_path, attachments)
